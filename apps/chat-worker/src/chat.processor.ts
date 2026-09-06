import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole, MessageStatus } from '@prisma/chat-client';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  CHAT_GENERATE_QUEUE,
  ChatAbortedError,
  chatAbortKey,
  type ChatGenerateJobData,
  type ChatProvider,
} from './chat.constants';
import { CorePrismaService } from './core-prisma.service';
import { ensureCustomerForChat } from './customer.ensure';
import { EventsPublisher } from './events.publisher';
import { GeminiService } from './gemini.service';
import { ModelRankService } from './model-rank.service';
import { OpenAiService } from './openai.service';
import {
  applyPlaceholders,
  buildPlaceholderValues,
} from './placeholders';
import { PrismaService } from './prisma.service';
import { boundPromptContext } from './prompt-budget';

@Processor(CHAT_GENERATE_QUEUE)
export class ChatGenerateProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatGenerateProcessor.name);
  private readonly redis: Redis;
  private readonly jobAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly corePrisma: CorePrismaService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenAiService,
    private readonly modelRank: ModelRankService,
    private readonly events: EventsPublisher,
    private readonly config: ConfigService,
    @InjectQueue(CHAT_GENERATE_QUEUE)
    private readonly chatQueue: Queue<ChatGenerateJobData>,
  ) {
    super();
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.jobAttempts = Number(this.config.get('CHAT_JOB_ATTEMPTS', 3));
  }

  private async isAborted(assistantMessageId: string): Promise<boolean> {
    const flag = await this.redis.get(chatAbortKey(assistantMessageId));
    if (flag) return true;

    const row = await this.prisma.chatMessage.findUnique({
      where: { id: assistantMessageId },
      select: { status: true },
    });
    return row?.status === MessageStatus.cancelled;
  }

  private async assertNotAborted(assistantMessageId: string): Promise<void> {
    if (await this.isAborted(assistantMessageId)) {
      throw new ChatAbortedError(assistantMessageId);
    }
  }

  async process(job: Job<ChatGenerateJobData>): Promise<void> {
    const {
      assistantMessageId,
      userMessageId,
      companyId,
      userId,
      conversationId,
      priorAttemptCount = 0,
    } = job.data;
    const provider: ChatProvider = job.data.provider ?? 'gemini';
    const attemptsMade = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? this.jobAttempts;
    const totalAttempts = priorAttemptCount + attemptsMade;

    if (await this.isAborted(assistantMessageId)) {
      this.logger.log(`Skipping aborted job for ${assistantMessageId}`);
      return;
    }

    await this.prisma.chatMessage.updateMany({
      where: {
        id: assistantMessageId,
        status: { in: [MessageStatus.pending, MessageStatus.processing] },
      },
      data: {
        status: MessageStatus.processing,
        attemptCount: totalAttempts,
        provider,
      },
    });

    if (await this.isAborted(assistantMessageId)) {
      this.logger.log(`Aborted after claim for ${assistantMessageId}`);
      return;
    }

    await this.events.publish({
      userId,
      assistantMessageId,
      userMessageId,
      status: 'processing',
      provider,
    });

    try {
      await this.assertNotAborted(assistantMessageId);

      const [company, guidelineVersion, agent, userMessage, conversation, history] =
        await Promise.all([
          this.corePrisma.company.findUnique({ where: { id: companyId } }),
          this.corePrisma.guidelineVersion.findFirst({
            where: { companyId, status: 'valid' },
            orderBy: { version: 'desc' },
            select: { id: true, content: true, contentHash: true, version: true },
          }),
          this.corePrisma.user.findUnique({ where: { id: userId } }),
          this.prisma.chatMessage.findUnique({ where: { id: userMessageId } }),
          conversationId
            ? this.prisma.conversation.findUnique({
                where: { id: conversationId },
              })
            : null,
          // History is scoped to the conversation; legacy jobs fall back to
          // orphan rows (conversationId null).
          this.prisma.chatMessage.findMany({
            where: {
              companyId,
              userId,
              conversationId: conversationId ?? null,
              status: MessageStatus.completed,
              id: { not: assistantMessageId },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        ]);

      if (!userMessage) {
        throw new Error('User message not found');
      }

      if (conversationId && !conversation) {
        this.logger.warn(
          `Refusing job ${assistantMessageId}: conversation ${conversationId} not found`,
        );
        throw new Error('Conversation not found');
      }

      // Defense in depth: the queued payload must match the conversation's
      // owner. Mismatch → no LLM call, job fails.
      if (
        conversation &&
        (conversation.companyId !== companyId ||
          conversation.userId !== userId)
      ) {
        this.logger.warn(
          `Refusing job ${assistantMessageId}: conversation ${conversation.id} does not match payload company/user`,
        );
        throw new Error('Conversation ownership mismatch');
      }

      // Resolve at execution time so replacements apply to existing
      // conversations and retries are traceable to the policy actually used.
      const guidelines = guidelineVersion?.content ?? null;

      await this.assertNotAborted(assistantMessageId);

      const customer = await ensureCustomerForChat(this.prisma, {
        companyId,
        agentUserId: userId,
        messageContent: userMessage.content,
        userMessageId,
        assistantMessageId,
      });

      const placeholders = buildPlaceholderValues({
        customerName: customer.displayName,
        companyName: company?.name,
        agentName: agent?.name,
        agentEmail: agent?.email,
      });

      const chronological = [...history].reverse().filter(
        (m) => m.id !== userMessageId || m.content.length > 0,
      );

      const model = await this.resolveModel(provider, attemptsMade);
      this.logger.log(
        `Generating provider=${provider} model=${model} attempt=${attemptsMade}/${maxAttempts}`,
      );

      const bounded = boundPromptContext({
        guidelines,
        history: chronological.map((m) => ({
          role: (m.role === MessageRole.user ? 'user' : 'assistant') as
            | 'user'
            | 'assistant',
          content: m.content,
        })),
        userMessage: userMessage.content,
      });

      const genParams = {
        guidelines: bounded.guidelines || null,
        history: bounded.history,
        userMessage: bounded.userMessage,
        placeholders,
        model,
      };

      const rawReply =
        provider === 'openai'
          ? await this.openai.generateReply(genParams)
          : await this.gemini.generateReply(genParams);

      const reply = applyPlaceholders(rawReply, placeholders);

      // Critical: do not write completed content if stopped during the LLM call.
      await this.assertNotAborted(assistantMessageId);

      const completed = await this.prisma.chatMessage.updateMany({
        where: {
          id: assistantMessageId,
          status: MessageStatus.processing,
        },
        data: {
          content: reply,
          status: MessageStatus.completed,
          lastError: null,
          model,
          provider,
          attemptCount: totalAttempts,
          customerId: customer.id,
          guidelineVersionId: guidelineVersion?.id ?? null,
          guidelineVersionHash: guidelineVersion?.contentHash ?? null,
        },
      });

      if (completed.count === 0) {
        this.logger.log(
          `Skipped completed write for ${assistantMessageId} (not processing)`,
        );
        return;
      }

      await this.events.publish({
        userId,
        assistantMessageId,
        userMessageId,
        status: 'completed',
        content: reply,
        model,
        provider,
      });
    } catch (err) {
      if (err instanceof ChatAbortedError) {
        this.logger.log(`Generation aborted for ${assistantMessageId}`);
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Job ${job.id} provider=${provider} attempt ${attemptsMade}/${maxAttempts} failed: ${message}`,
      );

      if (await this.isAborted(assistantMessageId)) {
        this.logger.log(
          `Aborted during failure handling for ${assistantMessageId}`,
        );
        return;
      }

      const isFinal = attemptsMade >= maxAttempts;
      if (isFinal && provider === 'gemini') {
        if (this.openai.isConfigured()) {
          await this.failoverToOpenAi(job.data, totalAttempts, message);
          return;
        }
        this.logger.warn(
          `Gemini exhausted; OPENAI_API_KEY unset — fail without OpenAI failover`,
        );
      }

      if (isFinal) {
        const failed = await this.prisma.chatMessage.updateMany({
          where: {
            id: assistantMessageId,
            status: { in: [MessageStatus.pending, MessageStatus.processing] },
          },
          data: {
            status: MessageStatus.failed,
            lastError: message,
            attemptCount: totalAttempts,
            provider,
          },
        });

        if (failed.count > 0) {
          await this.events.publish({
            userId,
            assistantMessageId,
            userMessageId,
            status: 'failed',
            error: message,
            provider,
          });
        }
      }

      throw err;
    }
  }

  /** BullMQ attempt N → Redis-ranked model index N-1 (Gemini preferred; OpenAI only on failover jobs). */
  private async resolveModel(
    provider: ChatProvider,
    attemptsMade: number,
  ): Promise<string> {
    const rank =
      provider === 'openai'
        ? await this.modelRank.getOpenAiRank()
        : await this.modelRank.getGeminiRank();
    const idx = Math.min(Math.max(attemptsMade - 1, 0), Math.max(rank.length - 1, 0));
    const picked = rank[idx];
    if (picked) return picked;
    return provider === 'openai'
      ? this.openai.getModelName()
      : this.gemini.getModelName();
  }

  private async failoverToOpenAi(
    data: ChatGenerateJobData,
    priorAttemptCount: number,
    lastError: string,
  ): Promise<void> {
    const { assistantMessageId, userMessageId, userId } = data;

    if (await this.isAborted(assistantMessageId)) {
      this.logger.log(`Skip OpenAI failover; aborted ${assistantMessageId}`);
      return;
    }

    if (!this.openai.isConfigured()) {
      this.logger.warn(
        `Skip OpenAI failover; OPENAI_API_KEY missing for ${assistantMessageId}`,
      );
      return;
    }

    this.logger.warn(
      `Gemini exhausted; failover to OpenAI for assistant=${assistantMessageId}`,
    );

    const claimed = await this.prisma.chatMessage.updateMany({
      where: {
        id: assistantMessageId,
        status: { in: [MessageStatus.pending, MessageStatus.processing] },
      },
      data: {
        status: MessageStatus.pending,
        lastError: `Gemini failed; failing over to OpenAI: ${lastError}`,
        attemptCount: priorAttemptCount,
        provider: 'openai',
      },
    });

    if (claimed.count === 0) {
      this.logger.log(
        `Skip OpenAI failover; message not in-flight ${assistantMessageId}`,
      );
      return;
    }

    await this.events.publish({
      userId,
      assistantMessageId,
      userMessageId,
      status: 'pending',
      provider: 'openai',
    });

    await this.chatQueue.add(
      'generate',
      {
        ...data,
        provider: 'openai',
        priorAttemptCount,
      },
      {
        attempts: this.jobAttempts,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
        // Distinct from Gemini jobId so BullMQ accepts the failover job.
        jobId: `chat-gen:${assistantMessageId}:openai`,
      },
    );
  }
}

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
  supportLocaleOf,
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
import { resolveGuidelineContext } from './guideline-context';
import { resolveProviderOrder } from './provider-policy';
import { LlmBudgetExceededError, LlmBudgetService } from './llm-budget';
import { screenModelOutput } from './output-policy';

@Processor(CHAT_GENERATE_QUEUE)
export class ChatGenerateProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatGenerateProcessor.name);
  private readonly redis: Redis;
  private readonly jobAttempts: number;
  private readonly providerOrder: ChatProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly corePrisma: CorePrismaService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenAiService,
    private readonly modelRank: ModelRankService,
    private readonly events: EventsPublisher,
    private readonly config: ConfigService,
    private readonly llmBudget: LlmBudgetService,
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
    this.providerOrder = resolveProviderOrder(
      this.config.get<string>('LLM_PROVIDER_ORDER'),
      { gemini: true, openai: this.openai.isConfigured() },
    );
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
    // Fresh jobs start at the head of the resolved provider order; failover
    // jobs arrive with attempts already spent and keep their target provider.
    const provider: ChatProvider =
      priorAttemptCount > 0
        ? (job.data.provider ?? this.providerOrder[0] ?? 'gemini')
        : (this.providerOrder[0] ?? 'gemini');
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

      // A conversation owns its guideline context. Management updates apply
      // to new conversations; they must not mutate an existing chat's policy.
      const guidelineContext = resolveGuidelineContext(
        conversation ?? {
          guidelineSnapshot: null,
          guidelineSnapshotHash: null,
          guidelineVersionId: null,
        },
        guidelineVersion,
      );
      const guidelines = guidelineContext?.content ?? null;

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

      // Fail closed before any provider call (LLM06 worker budgets).
      await this.llmBudget.assertAllowed(companyId);

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
        history: bounded.history.map((message) => ({
          role: message.role === 'user' ? ('agent' as const) : ('copilot' as const),
          content: message.content,
        })),
        userMessage: bounded.userMessage,
        placeholders,
        mode: job.data.mode ?? ('agent' as const),
        model,
        locale: supportLocaleOf(job.data.locale),
      };

      const rawReply =
        provider === 'openai'
          ? await this.openai.generateReply(genParams)
          : await this.gemini.generateReply(genParams);

      const reply = applyPlaceholders(rawReply, placeholders);

      // Model output is untrusted input: an agent may paste this reply to a
      // customer, so refuse to persist or publish an exfiltration payload
      // (OWASP LLM10). Screening after substitution covers injected values.
      screenModelOutput(reply);

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
          guidelineVersionId: guidelineContext?.id ?? null,
          guidelineVersionHash: guidelineContext?.contentHash ?? null,
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

      if (err instanceof LlmBudgetExceededError) {
        this.logger.warn(
          `LLM budget halt for ${assistantMessageId}: ${err.reason} company=${err.companyId}`,
        );
        const failed = await this.prisma.chatMessage.updateMany({
          where: {
            id: assistantMessageId,
            status: { in: [MessageStatus.pending, MessageStatus.processing] },
          },
          data: {
            status: MessageStatus.failed,
            lastError: err.message,
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
            error: err.message,
            provider,
          });
        }
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
      if (isFinal) {
        const nextProvider = this.nextProviderAfter(provider);
        if (nextProvider) {
          await this.failoverToProvider(
            nextProvider,
            provider,
            job.data,
            totalAttempts,
            message,
          );
          return;
        }
        this.logger.warn(
          `Provider ${provider} exhausted; no further configured provider in LLM_PROVIDER_ORDER — failing without failover`,
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

  /** BullMQ attempt N → Redis-ranked model index N-1 for the job's provider (order-resolved; next provider only on failover jobs). */
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

  /** Next provider in LLM_PROVIDER_ORDER after the failed one, if any. */
  private nextProviderAfter(provider: ChatProvider): ChatProvider | undefined {
    const idx = this.providerOrder.indexOf(provider);
    return idx >= 0 ? this.providerOrder[idx + 1] : undefined;
  }

  private async failoverToProvider(
    target: ChatProvider,
    failedProvider: ChatProvider,
    data: ChatGenerateJobData,
    priorAttemptCount: number,
    lastError: string,
  ): Promise<void> {
    const { assistantMessageId, userMessageId, userId } = data;

    if (await this.isAborted(assistantMessageId)) {
      this.logger.log(`Skip ${target} failover; aborted ${assistantMessageId}`);
      return;
    }

    if (!this.providerOrder.includes(target)) {
      this.logger.warn(
        `Skip ${target} failover; provider not configured for ${assistantMessageId}`,
      );
      return;
    }

    this.logger.warn(
      `${failedProvider} exhausted; failover to ${target} for assistant=${assistantMessageId}`,
    );

    const claimed = await this.prisma.chatMessage.updateMany({
      where: {
        id: assistantMessageId,
        status: { in: [MessageStatus.pending, MessageStatus.processing] },
      },
      data: {
        status: MessageStatus.pending,
        lastError: `${failedProvider} failed; failing over to ${target}: ${lastError}`,
        attemptCount: priorAttemptCount,
        provider: target,
      },
    });

    if (claimed.count === 0) {
      this.logger.log(
        `Skip ${target} failover; message not in-flight ${assistantMessageId}`,
      );
      return;
    }

    await this.events.publish({
      userId,
      assistantMessageId,
      userMessageId,
      status: 'pending',
      provider: target,
    });

    await this.chatQueue.add(
      'generate',
      {
        ...data,
        provider: target,
        priorAttemptCount,
      },
      {
        attempts: this.jobAttempts,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
        // Distinct jobId per target provider so BullMQ accepts the failover job.
        jobId: `chat-gen:${assistantMessageId}:${target}`,
      },
    );
  }
}

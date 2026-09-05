import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { MessageRole, MessageStatus } from '@prisma/chat-client';
import { Queue } from 'bullmq';
import { SessionData } from '../auth/session.types';
import { ChatPrismaService } from '../prisma/chat-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CONVERSATION_SOLVED_CONFLICT,
  ConversationsService,
  isConversationFinal,
} from './conversations.service';
import {
  CHAT_ABORT_TTL_SECONDS,
  CHAT_EVENTS_CHANNEL,
  CHAT_GENERATE_QUEUE,
  CHAT_IDEM_PENDING,
  CHAT_IDEM_TTL_SECONDS,
  CHAT_RATE_LIMIT_WINDOW_SECONDS,
  chatAbortKey,
  chatIdemKey,
  type ChatGenerateJobData,
  type ChatJobEvent,
} from './chat.constants';
import type { CreateChatDto } from './dto/create-chat.dto';

const IN_FLIGHT: MessageStatus[] = [
  MessageStatus.pending,
  MessageStatus.processing,
];

type IdempotentClaim =
  | { outcome: 'new'; redisKey: string | null }
  | { outcome: 'processing' }
  | { outcome: 'replay'; response: Record<string, unknown> };

@Injectable()
export class ChatService {
  private readonly jobAttempts: number;
  private readonly rateLimitPerMinute: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatPrisma: ChatPrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly conversations: ConversationsService,
    @InjectQueue(CHAT_GENERATE_QUEUE)
    private readonly chatQueue: Queue<ChatGenerateJobData>,
  ) {
    this.jobAttempts = Number(this.config.get('CHAT_JOB_ATTEMPTS', 3));
    this.rateLimitPerMinute = Number(
      this.config.get('CHAT_RATE_LIMIT_PER_MINUTE', 20),
    );
  }

  private serializeMessage(message: {
    id: string;
    content: string;
    role: MessageRole;
    status: MessageStatus;
    parentMessageId: string | null;
    attemptCount: number;
    lastError: string | null;
    model: string | null;
    provider?: string | null;
    conversationId?: string | null;
    createdAt: Date;
    companyId: string;
  }) {
    return {
      id: message.id,
      content: message.content,
      role: message.role,
      status: message.status,
      parentMessageId: message.parentMessageId,
      attemptCount: message.attemptCount,
      lastError: message.lastError,
      model: message.model,
      provider: message.provider ?? null,
      conversationId: message.conversationId ?? null,
      createdAt: message.createdAt,
      companyId: message.companyId,
    };
  }

  private async publishEvent(event: ChatJobEvent) {
    await this.redis
      .getClient()
      .publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event));
  }

  private async setAbortFlag(assistantMessageId: string) {
    await this.redis
      .getClient()
      .set(chatAbortKey(assistantMessageId), '1', 'EX', CHAT_ABORT_TTL_SECONDS);
  }

  private async removeQueueJobsForMessage(assistantMessageId: string) {
    const jobs = await this.chatQueue.getJobs([
      'waiting',
      'delayed',
      'active',
    ]);
    await Promise.all(
      jobs
        .filter((job) => job.data?.assistantMessageId === assistantMessageId)
        .map(async (job) => {
          try {
            await job.remove();
          } catch {
            // Active jobs may refuse remove; abort flag still stops write.
          }
        }),
    );
  }

  /**
   * Marks in-flight assistant messages cancelled, sets Redis abort flags,
   * best-effort removes BullMQ jobs, and publishes job:update cancelled.
   */
  private async cancelInFlightForUser(
    userId: string,
    companyId: string,
    exceptId?: string,
  ) {
    const inFlight = await this.chatPrisma.chatMessage.findMany({
      where: {
        userId,
        companyId,
        role: MessageRole.assistant,
        status: { in: IN_FLIGHT },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });

    if (inFlight.length === 0) return;

    await Promise.all(
      inFlight.map(async (msg) => {
        await this.setAbortFlag(msg.id);
        await this.removeQueueJobsForMessage(msg.id);

        const updated = await this.chatPrisma.chatMessage.updateMany({
          where: {
            id: msg.id,
            status: { in: IN_FLIGHT },
          },
          data: {
            status: MessageStatus.cancelled,
            lastError: null,
          },
        });

        if (updated.count > 0) {
          await this.publishEvent({
            userId,
            assistantMessageId: msg.id,
            userMessageId: msg.parentMessageId ?? '',
            status: 'cancelled',
          });
        }
      }),
    );
  }

  private async enqueueGenerate(data: ChatGenerateJobData) {
    const provider = data.provider ?? 'gemini';
    await this.chatQueue.add(
      'generate',
      { ...data, provider },
      {
        attempts: this.jobAttempts,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
        jobId: `chat-gen:${data.assistantMessageId}:${provider}`,
      },
    );
  }

  /**
   * Fixed 1-minute send window per (companyId, userId): INCR a bucket
   * counter (TTL-scoped) and reject with 429 past the configured cap.
   */
  private async enforceSendRateLimit(userId: string, companyId: string) {
    const bucket = Math.floor(
      Date.now() / (CHAT_RATE_LIMIT_WINDOW_SECONDS * 1000),
    );
    const key = `chat:rate:${companyId}:${userId}:${bucket}`;
    const count = await this.redis.getClient().incr(key);

    if (count === 1) {
      await this.redis
        .getClient()
        .expire(key, CHAT_RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > this.rateLimitPerMinute) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many messages — wait a moment and try again',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Claims the optional idempotency key for company+user (SET NX, 24h TTL).
   * A fresh claim returns the Redis key to store the response under; a
   * replay returns the stored original response; a still-processing claim
   * is reported so the caller answers 409 instead of duplicating the send.
   */
  private async claimIdempotentSend(
    companyId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<IdempotentClaim> {
    if (!idempotencyKey) {
      return { outcome: 'new', redisKey: null };
    }

    if (idempotencyKey.length > 64) {
      throw new BadRequestException('Idempotency key too long');
    }

    const redisKey = chatIdemKey(companyId, userId, idempotencyKey);
    const claimed = await this.redis
      .getClient()
      .set(redisKey, CHAT_IDEM_PENDING, 'EX', CHAT_IDEM_TTL_SECONDS, 'NX');

    if (claimed) {
      return { outcome: 'new', redisKey };
    }

    const stored = await this.redis.getClient().get(redisKey);
    if (stored === null) {
      // Expired between the failed claim and the read: treat as fresh.
      return { outcome: 'new', redisKey };
    }

    if (stored === CHAT_IDEM_PENDING) {
      return { outcome: 'processing' };
    }

    return { outcome: 'replay', response: JSON.parse(stored) };
  }

  async listMessages(session: SessionData, limit = 50) {
    if (!session.activeCompanyId) {
      throw new BadRequestException('No active company in session');
    }

    const take = Math.min(Math.max(limit, 1), 100);
    const messages = await this.chatPrisma.chatMessage.findMany({
      where: {
        companyId: session.activeCompanyId,
        userId: session.userId,
      },
      orderBy: { createdAt: 'asc' },
      take,
    });

    return messages.map((m) => this.serializeMessage(m));
  }

  /**
   * Resolves the target conversation for POST /chat: verifies the supplied id
   * belongs to session company+user (404 otherwise) and is not in a final
   * status (409), or auto-creates a fresh conversation with sticky guidance.
   */
  private async resolveConversationForMessage(
    session: SessionData,
    conversationId?: string,
  ): Promise<{ id: string; title: string | null }> {
    if (conversationId) {
      const conversation = await this.conversations.getWritableConversation(
        session,
        conversationId,
      );
      return { id: conversation.id, title: conversation.title };
    }

    const created = await this.conversations.create(session, {});
    return { id: created.id, title: created.title ?? null };
  }

  async createUserMessage(
    session: SessionData,
    dto: CreateChatDto,
    idempotencyKey?: string,
  ) {
    if (!session.activeCompanyId) {
      throw new BadRequestException('No active company in session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const companyId = session.activeCompanyId;

    const claim = await this.claimIdempotentSend(
      companyId,
      session.userId,
      idempotencyKey,
    );

    if (claim.outcome === 'processing') {
      throw new ConflictException('Already sending this message');
    }

    if (claim.outcome === 'replay') {
      return claim.response;
    }

    try {
      await this.enforceSendRateLimit(session.userId, companyId);

      const conversation = await this.resolveConversationForMessage(
        session,
        dto.conversationId,
      );

      // Takeover: cancel any in-flight assistant generations for this stream.
      await this.cancelInFlightForUser(session.userId, companyId);

      const now = new Date();
      const result = await this.chatPrisma.$transaction(async (tx) => {
        const userMessage = await tx.chatMessage.create({
          data: {
            companyId,
            userId: session.userId,
            conversationId: conversation.id,
            role: MessageRole.user,
            content: dto.message,
            status: MessageStatus.completed,
          },
        });

        const assistantMessage = await tx.chatMessage.create({
          data: {
            companyId,
            userId: session.userId,
            conversationId: conversation.id,
            role: MessageRole.assistant,
            content: '',
            status: MessageStatus.pending,
            parentMessageId: userMessage.id,
            provider: 'gemini',
          },
        });

        const titleUpdate =
          conversation.title && conversation.title.trim().length > 0
            ? {}
            : { title: dto.message.trim().slice(0, 200) };

        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: now, ...titleUpdate },
        });

        return { userMessage, assistantMessage };
      });

      await this.enqueueGenerate({
        assistantMessageId: result.assistantMessage.id,
        userMessageId: result.userMessage.id,
        companyId,
        userId: session.userId,
        conversationId: conversation.id,
        provider: 'gemini',
      });

      const response = {
        status: 'pending' as const,
        message: this.serializeMessage(result.userMessage),
        assistantMessage: this.serializeMessage(result.assistantMessage),
        reply: null,
        conversationId: conversation.id,
      };

      if (claim.redisKey) {
        await this.redis
          .getClient()
          .set(
            claim.redisKey,
            JSON.stringify(response),
            'EX',
            CHAT_IDEM_TTL_SECONDS,
          );
      }

      return response;
    } catch (err) {
      if (claim.redisKey) {
        // Release the claim so a failed send can be retried with the same key.
        await this.redis
          .getClient()
          .del(claim.redisKey)
          .catch(() => undefined);
      }
      throw err;
    }
  }

  async stopAssistantMessage(session: SessionData, assistantMessageId: string) {
    if (!session.activeCompanyId) {
      throw new BadRequestException('No active company in session');
    }

    const message = await this.chatPrisma.chatMessage.findUnique({
      where: { id: assistantMessageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.companyId !== session.activeCompanyId) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== session.userId) {
      throw new NotFoundException('Message not found');
    }

    if (message.conversationId) {
      // Message lives in a conversation: it must belong to session company+user.
      await this.conversations.getOwnedConversation(
        session,
        message.conversationId,
      );
    }

    if (message.role !== MessageRole.assistant) {
      throw new BadRequestException('Only assistant messages can be stopped');
    }

    if (
      message.status !== MessageStatus.pending &&
      message.status !== MessageStatus.processing
    ) {
      return {
        status: message.status,
        assistantMessage: this.serializeMessage(message),
      };
    }

    await this.setAbortFlag(message.id);
    await this.removeQueueJobsForMessage(message.id);

    const updated = await this.chatPrisma.chatMessage.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.cancelled,
        lastError: null,
      },
    });

    await this.publishEvent({
      userId: session.userId,
      assistantMessageId: updated.id,
      userMessageId: updated.parentMessageId ?? '',
      status: 'cancelled',
      provider: (updated.provider as 'gemini' | 'openai' | null) ?? undefined,
    });

    return {
      status: 'cancelled' as const,
      assistantMessage: this.serializeMessage(updated),
    };
  }

  async retryAssistantMessage(session: SessionData, assistantMessageId: string) {
    if (!session.activeCompanyId) {
      throw new BadRequestException('No active company in session');
    }

    // Retries trigger LLM work too, so they share the send-rate window.
    await this.enforceSendRateLimit(session.userId, session.activeCompanyId);

    const message = await this.chatPrisma.chatMessage.findUnique({
      where: { id: assistantMessageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.companyId !== session.activeCompanyId) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== session.userId) {
      throw new NotFoundException('Message not found');
    }

    if (message.conversationId) {
      // Message lives in a conversation: it must belong to session company+user
      // and must not be in a final status (reopen first).
      const conversation = await this.conversations.getOwnedConversation(
        session,
        message.conversationId,
      );
      if (isConversationFinal(conversation.status)) {
        throw new ConflictException(CONVERSATION_SOLVED_CONFLICT);
      }
    }

    if (message.role !== MessageRole.assistant) {
      throw new BadRequestException('Only assistant messages can be retried');
    }

    if (message.status !== MessageStatus.failed) {
      throw new BadRequestException('Only failed messages can be retried');
    }

    if (!message.parentMessageId) {
      throw new BadRequestException('Assistant message missing parent');
    }

    await this.redis.getClient().del(chatAbortKey(message.id));

    const updated = await this.chatPrisma.chatMessage.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.pending,
        lastError: null,
        content: '',
        attemptCount: 0,
        provider: 'gemini',
        model: null,
      },
    });

    await this.enqueueGenerate({
      assistantMessageId: updated.id,
      userMessageId: message.parentMessageId,
      companyId: message.companyId,
      userId: session.userId,
      conversationId: message.conversationId ?? undefined,
      provider: 'gemini',
    });

    return {
      status: 'pending' as const,
      assistantMessage: this.serializeMessage(updated),
    };
  }
}

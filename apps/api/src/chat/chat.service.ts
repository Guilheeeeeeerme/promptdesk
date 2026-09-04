import {
  BadRequestException,
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
  CHAT_ABORT_TTL_SECONDS,
  CHAT_EVENTS_CHANNEL,
  CHAT_GENERATE_QUEUE,
  chatAbortKey,
  type ChatGenerateJobData,
  type ChatJobEvent,
} from './chat.constants';

const IN_FLIGHT: MessageStatus[] = [
  MessageStatus.pending,
  MessageStatus.processing,
];

@Injectable()
export class ChatService {
  private readonly jobAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatPrisma: ChatPrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    @InjectQueue(CHAT_GENERATE_QUEUE)
    private readonly chatQueue: Queue<ChatGenerateJobData>,
  ) {
    this.jobAttempts = Number(this.config.get('CHAT_JOB_ATTEMPTS', 3));
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

  async createUserMessage(session: SessionData, content: string) {
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

    // Takeover: cancel any in-flight assistant generations for this stream.
    await this.cancelInFlightForUser(session.userId, companyId);

    const result = await this.chatPrisma.$transaction(async (tx) => {
      const userMessage = await tx.chatMessage.create({
        data: {
          companyId,
          userId: session.userId,
          role: MessageRole.user,
          content,
          status: MessageStatus.completed,
        },
      });

      const assistantMessage = await tx.chatMessage.create({
        data: {
          companyId,
          userId: session.userId,
          role: MessageRole.assistant,
          content: '',
          status: MessageStatus.pending,
          parentMessageId: userMessage.id,
          provider: 'gemini',
        },
      });

      return { userMessage, assistantMessage };
    });

    await this.enqueueGenerate({
      assistantMessageId: result.assistantMessage.id,
      userMessageId: result.userMessage.id,
      companyId,
      userId: session.userId,
      provider: 'gemini',
    });

    return {
      status: 'pending' as const,
      message: this.serializeMessage(result.userMessage),
      assistantMessage: this.serializeMessage(result.assistantMessage),
      reply: null,
    };
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
      provider: 'gemini',
    });

    return {
      status: 'pending' as const,
      assistantMessage: this.serializeMessage(updated),
    };
  }
}

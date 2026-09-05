import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConversationStatus, MessageRole, MessageStatus } from '@prisma/chat-client';
import type { ChatMessage, Conversation } from '@prisma/chat-client';
import { isPlatformRole } from '../auth/session.types';
import type { SessionData } from '../auth/session.types';
import { ChatPrismaService } from '../prisma/chat-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CHAT_EVENTS_CHANNEL } from './chat.constants';
import type {
  ChatAgentMessageEvent,
  ChatConversationUpdateEvent,
  ChatMessageEventPayload,
} from './chat.constants';
import type {
  CreateConversationDto,
  UpdateConversationDto,
} from './dto/create-chat.dto';
import type { CreateAgentMessageDto } from './dto/create-agent-message.dto';
import { MAX_CONVERSATION_SEARCH_LENGTH } from './chat.guards';

export const FINAL_CONVERSATION_STATUSES: ConversationStatus[] = [
  ConversationStatus.solved,
  ConversationStatus.not_solved,
  ConversationStatus.wont_solve,
];

export function isConversationFinal(status: ConversationStatus): boolean {
  return FINAL_CONVERSATION_STATUSES.includes(status);
}

export const CONVERSATION_SOLVED_CONFLICT =
  'Conversation is solved; reopen to continue';

export const OWNER_STATUS_CHOICES: ConversationStatus[] = [
  ConversationStatus.open,
  ConversationStatus.solved,
  ConversationStatus.not_solved,
];

export const CONVERSATION_WONT_SOLVE_FORBIDDEN =
  "Only platform admins can mark a conversation as won't solve";

export const CONVERSATION_RATING_NOT_FINISHED =
  'Rating is only available for finished conversations (solved, not solved, or won\u2019t solve)';

function canViewCompanyHistory(session: SessionData): boolean {
  return isPlatformRole(session.role) || session.role === 'manager';
}

/** Query params arrive as strings; normalized here. */
export interface ListConversationsFilters {
  status?: string;
  pinned?: string;
  archived?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * Sticky guidance binding result. guidelineVersionId holds a sha256 content
 * token (same scheme as GuidelineVersion.contentHash in the guideline-versions
 * sibling) — swapping to real version ids later is a small diff in bindGuideline.
 */
interface BoundGuideline {
  guidelineVersionId: string | null;
  guidelineSnapshot: string | null;
  guidelineSnapshotHash: string | null;
  guidelineBoundAt: Date | null;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatPrisma: ChatPrismaService,
    private readonly redis: RedisService,
  ) {}

  private publishEvent(event: ChatAgentMessageEvent | ChatConversationUpdateEvent) {
    void this.redis
      .getClient()
      .publish(CHAT_EVENTS_CHANNEL, JSON.stringify(event))
      .catch(() => undefined);
  }

  private serializeConversation(conversation: Conversation) {
    return {
      id: conversation.id,
      companyId: conversation.companyId,
      userId: conversation.userId,
      customerId: conversation.customerId,
      title: conversation.title,
      pinned: conversation.pinned,
      archived: conversation.archived,
      status: conversation.status,
      rating: conversation.rating,
      guidelineVersionId: conversation.guidelineVersionId,
      guidelineSnapshotHash: conversation.guidelineSnapshotHash,
      guidelineBoundAt: conversation.guidelineBoundAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      resolvedAt: conversation.resolvedAt,
    };
  }

  /** Man-in-the-middle enrichment: who owns each thread (core DB lookup). */
  private async attachOwners(
    session: SessionData,
    conversations: Conversation[],
  ): Promise<
    (
      | ReturnType<ConversationsService['serializeConversation']>
      | (ReturnType<ConversationsService['serializeConversation']> & {
          ownerName: string | null;
          ownerEmail: string | null;
        })
    )[]
  > {
    const base = conversations.map((c) => this.serializeConversation(c));
    if (!canViewCompanyHistory(session) || base.length === 0) return base;

    const ownerIds = [...new Set(base.map((c) => c.userId))];
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(owners.map((u) => [u.id, u]));

    return base.map((c) => {
      const owner = byId.get(c.userId);
      return {
        ...c,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
      };
    });
  }

  private serializeMessage(message: ChatMessage) {
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
      conversationId: message.conversationId,
      createdAt: message.createdAt,
    };
  }

  private assertActiveCompany(session: SessionData): string {
    if (!session.activeCompanyId) {
      throw new BadRequestException('No active company in session');
    }
    return session.activeCompanyId;
  }

  /**
   * Ownership gate: conversation must belong to the session's active company
   * AND the session user (user isolation on top of tenant isolation), and must
   * not be soft-deleted. Cross-company / cross-user / deleted → 404.
   * Shared with ChatService for stop/retry/message ownership checks.
   */
  async getOwnedConversation(
    session: SessionData,
    conversationId: string,
  ): Promise<Conversation> {
    const companyId = this.assertActiveCompany(session);

    const conversation = await this.chatPrisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (
      !conversation ||
      conversation.companyId !== companyId ||
      conversation.userId !== session.userId ||
      conversation.deletedAt
    ) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Company access gate: same tenant isolation as getOwnedConversation, but
   * platform roles (root/admin) reach every thread in the company — they are
   * the man in the middle. Agents stay locked to their own threads.
   */
  async getAccessibleConversation(
    session: SessionData,
    conversationId: string,
  ): Promise<Conversation> {
    if (isPlatformRole(session.role)) {
      const companyId = this.assertActiveCompany(session);

      const conversation = await this.chatPrisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (
        !conversation ||
        conversation.companyId !== companyId ||
        conversation.deletedAt
      ) {
        throw new NotFoundException('Conversation not found');
      }

      return conversation;
    }

    return this.getOwnedConversation(session, conversationId);
  }

  /** Read gate: managers and platform roles can inspect any live thread in the active company. */
  private async getReadableConversation(
    session: SessionData,
    conversationId: string,
  ): Promise<Conversation> {
    if (canViewCompanyHistory(session)) {
      const companyId = this.assertActiveCompany(session);
      const conversation = await this.chatPrisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (
        !conversation ||
        conversation.companyId !== companyId ||
        conversation.deletedAt
      ) {
        throw new NotFoundException('Conversation not found');
      }

      return conversation;
    }

    return this.getOwnedConversation(session, conversationId);
  }

  /**
   * Owner + writable gate for POST /chat: strictly the owner (agent), never a
   * platform bystander — the LLM job payload must match conversation.userId.
   */
  async getWritableConversation(
    session: SessionData,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.getOwnedConversation(session, conversationId);

    if (isConversationFinal(conversation.status)) {
      throw new ConflictException(CONVERSATION_SOLVED_CONFLICT);
    }

    return conversation;
  }

  /**
   * Platform gate for the man in the middle: admin/root may read the thread
   * and reply manually while the conversation is still open. Final statuses
   * (solved / not_solved / wont_solve) stay view-only until reopened.
   */
  async getAgentWritableConversation(
    session: SessionData,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.getAccessibleConversation(
      session,
      conversationId,
    );

    if (isConversationFinal(conversation.status)) {
      throw new ConflictException(CONVERSATION_SOLVED_CONFLICT);
    }

    return conversation;
  }

  /**
   * Sticky guidance binding: read the core company guideline ONCE at
   * conversation start and freeze it (snapshot + sha256). Subsequent jobs never
   * re-read live guidelines; guideline replace/clear does not affect this chat.
   */
  private async bindGuideline(companyId: string): Promise<BoundGuideline> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { guidelineText: true },
    });

    const text = company?.guidelineText;
    if (!text) {
      return {
        guidelineVersionId: null,
        guidelineSnapshot: null,
        guidelineSnapshotHash: null,
        guidelineBoundAt: null,
      };
    }

    const hash = createHash('sha256').update(text).digest('hex');
    return {
      guidelineVersionId: hash,
      guidelineSnapshot: text,
      guidelineSnapshotHash: hash,
      guidelineBoundAt: new Date(),
    };
  }

  async list(session: SessionData, filters: ListConversationsFilters) {
    const companyId = this.assertActiveCompany(session);

    if (filters.q && filters.q.length > MAX_CONVERSATION_SEARCH_LENGTH) {
      throw new BadRequestException('Search query is too long');
    }

    if (
      filters.status !== undefined &&
      filters.status !== '' &&
      !Object.values(ConversationStatus).includes(
        filters.status as ConversationStatus,
      )
    ) {
      throw new BadRequestException('Invalid status filter');
    }

    const pinned =
      filters.pinned === undefined || filters.pinned === ''
        ? undefined
        : filters.pinned === 'true';
    const archived =
      filters.archived === undefined || filters.archived === ''
        ? undefined
        : filters.archived === 'true';

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    const conversations = await this.chatPrisma.conversation.findMany({
      where: {
        companyId,
        // Platform roles (root/admin) see every agent thread in the company;
        // everyone else stays locked to their own.
        ...(canViewCompanyHistory(session) ? {} : { userId: session.userId }),
        deletedAt: null,
        ...(filters.status !== undefined && filters.status !== ''
          ? { status: filters.status as ConversationStatus }
          : {}),
        ...(pinned === undefined ? {} : { pinned }),
        ...(archived === undefined ? {} : { archived }),
        ...(filters.q
          ? {
              OR: [
                {
                  title: {
                    contains: filters.q,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  messages: {
                    some: {
                      content: {
                        contains: filters.q,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: limit,
      skip: offset,
    });

    return this.attachOwners(session, conversations);
  }

  async detail(session: SessionData, conversationId: string) {
    const conversation = await this.getReadableConversation(
      session,
      conversationId,
    );
    const [withOwner] = await this.attachOwners(session, [conversation]);
    return withOwner;
  }

  /**
   * Man-in-the-middle effectiveness panel: the past 7 days per company —
   * resolution rate, average time to resolve and rating average bind
   * chat → directive snapshot → status → rate.
   */
  async summary(session: SessionData) {
    if (!isPlatformRole(session.role)) {
      throw new ForbiddenException(
        'Summary is only available to platform admins',
      );
    }
    const companyId = this.assertActiveCompany(session);

    const windowDays = 7;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const conversations = await this.chatPrisma.conversation.findMany({
      where: { companyId, deletedAt: null, createdAt: { gte: since } },
      select: {
        status: true,
        rating: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const byStatus = { open: 0, solved: 0, not_solved: 0, wont_solve: 0 };
    const resolveDurations: number[] = [];
    const ratings: number[] = [];

    for (const c of conversations) {
      byStatus[c.status] += 1;
      if (isConversationFinal(c.status) && c.resolvedAt) {
        resolveDurations.push(c.resolvedAt.getTime() - c.createdAt.getTime());
      }
      if (c.rating != null) ratings.push(c.rating);
    }

    const finalized = byStatus.solved + byStatus.not_solved + byStatus.wont_solve;
    const avg = (xs: number[]) =>
      xs.length === 0
        ? null
        : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

    return {
      windowDays,
      total: conversations.length,
      open: byStatus.open,
      solved: byStatus.solved,
      notSolved: byStatus.not_solved,
      wontSolve: byStatus.wont_solve,
      resolutionRate: finalized === 0 ? null : Math.round((byStatus.solved / finalized) * 1000) / 10,
      avgResolveSeconds:
        resolveDurations.length === 0
          ? null
          : Math.round(resolveDurations.reduce((a, b) => a + b, 0) / resolveDurations.length / 1000),
      avgRating: avg(ratings),
      ratedCount: ratings.length,
    };
  }

  async listMessages(session: SessionData, conversationId: string) {
    await this.getReadableConversation(session, conversationId);

    const messages = await this.chatPrisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => this.serializeMessage(m));
  }

  async create(session: SessionData, dto: CreateConversationDto) {
    const companyId = this.assertActiveCompany(session);

    const binding = await this.bindGuideline(companyId);

    const conversation = await this.chatPrisma.conversation.create({
      data: {
        companyId,
        userId: session.userId,
        title: dto.title ?? null,
        ...binding,
      },
    });

    return this.serializeConversation(conversation);
  }

  async update(
    session: SessionData,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    const conversation = await this.getAccessibleConversation(
      session,
      conversationId,
    );

    if (dto.title !== undefined && dto.title.trim().length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    // State machine: agents (owners) may only pick solved / not_solved and
    // reopen to open. wont_solve is the platform man-in-the-middle call.
    if (dto.status !== undefined) {
      const next = dto.status as ConversationStatus;
      if (
        !isPlatformRole(session.role) &&
        !OWNER_STATUS_CHOICES.includes(next)
      ) {
        throw new ForbiddenException(CONVERSATION_WONT_SOLVE_FORBIDDEN);
      }
    }

    // Rating is the user's verdict on a FINISHED conversation; it binds
    // chat → directive snapshot → status → rate for effectiveness tracking.
    if (dto.rating !== undefined && !isConversationFinal(conversation.status)) {
      throw new BadRequestException(CONVERSATION_RATING_NOT_FINISHED);
    }

    // PATCH stays allowed in final status — that is how reopen works.
    const updated = await this.chatPrisma.conversation.update({
      where: { id: conversation.id },
      data: {
        title: dto.title,
        pinned: dto.pinned,
        archived: dto.archived,
        status: dto.status as ConversationStatus | undefined,
        rating: dto.rating,
        // resolvedAt anchors resolve-time analytics: first entry into a final
        // state stamps it, reopen clears it.
        ...(dto.status === undefined
          ? {}
          : isConversationFinal(dto.status as ConversationStatus)
            ? { resolvedAt: conversation.resolvedAt ?? new Date() }
            : { resolvedAt: null }),
      },
    });

    // Live-sync the man-in-the-middle state call to the owning agent's chat.
    if (updated.status !== conversation.status) {
      this.publishEvent({
        type: 'conversation_update',
        ownerId: conversation.userId,
        conversationId: updated.id,
        status: updated.status,
        lastMessageAt: updated.lastMessageAt
          ? updated.lastMessageAt.toISOString()
          : null,
      });
    }

    return this.serializeConversation(updated);
  }

  /**
   * Human in the loop: platform admins (root/admin) reply manually in any
   * company thread. The message is stored under the thread owner's identity so
   * the owner's transcript and isolation checks stay intact; the LLM worker
   * folds agent messages into its context automatically.
   */
  async createAgentMessage(
    session: SessionData,
    conversationId: string,
    dto: CreateAgentMessageDto,
  ) {
    if (!isPlatformRole(session.role)) {
      throw new ForbiddenException(
        'Only platform admins can reply manually in a conversation',
      );
    }

    const conversation = await this.getAgentWritableConversation(
      session,
      conversationId,
    );

    const message = await this.chatPrisma.chatMessage.create({
      data: {
        companyId: conversation.companyId,
        userId: conversation.userId,
        conversationId: conversation.id,
        role: MessageRole.agent,
        content: dto.content,
        status: MessageStatus.completed,
      },
    });

    const now = new Date();
    await this.chatPrisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    const payload: ChatMessageEventPayload = {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      status: message.status,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };

    this.publishEvent({
      type: 'agent_message',
      ownerId: conversation.userId,
      conversationId: conversation.id,
      message: payload,
    });

    return payload;
  }

  async softDelete(session: SessionData, conversationId: string) {
    const conversation = await this.getOwnedConversation(session, conversationId);

    const updated = await this.chatPrisma.conversation.update({
      where: { id: conversation.id },
      data: { deletedAt: new Date() },
    });

    return this.serializeConversation(updated);
  }
}

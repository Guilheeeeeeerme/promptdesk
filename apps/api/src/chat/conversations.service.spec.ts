import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ConversationStatus,
  MessageRole,
  MessageStatus,
} from '@prisma/chat-client';
import type { Conversation } from '@prisma/chat-client';
import type { SessionData } from '../auth/session.types';

jest.mock('../prisma/chat-prisma.service', () => ({
  ChatPrismaService: class ChatPrismaService {},
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

import { ConversationsService } from './conversations.service';

describe('ConversationsService history visibility', () => {
  const companyA = 'company-a';
  const companyB = 'company-b';
  const ownerId = 'agent-owner';
  const otherOwnerId = 'other-agent';

  const session = (
    role: SessionData['role'],
    userId = `${role}-user`,
    activeCompanyId: string | null = companyA,
  ): SessionData => ({
    userId,
    role,
    activeCompanyId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const conversation = (overrides: Partial<Conversation> = {}) =>
    ({
      id: 'conversation-1',
      companyId: companyA,
      userId: ownerId,
      customerId: null,
      title: 'Conversation',
      pinned: false,
      archived: false,
      deletedAt: null,
      status: ConversationStatus.open,
      resolvedAt: null,
      rating: null,
      guidelineVersionId: null,
      guidelineSnapshot: null,
      guidelineSnapshotHash: null,
      guidelineBoundAt: null,
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
      lastMessageAt: new Date('2026-09-01T00:00:00Z'),
      messages: [],
      ...overrides,
    }) as Conversation;

  const prisma = { user: { findMany: jest.fn() } };
  const chatPrisma = {
    conversation: { findMany: jest.fn(), findUnique: jest.fn() },
    chatMessage: { findMany: jest.fn() },
  };
  const redis = { getClient: jest.fn() };
  let conversations: ConversationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([
      { id: ownerId, name: 'Owner', email: 'owner@example.com' },
    ]);
    chatPrisma.conversation.findMany.mockResolvedValue([conversation()]);
    chatPrisma.conversation.findUnique.mockResolvedValue(conversation());
    chatPrisma.chatMessage.findMany.mockResolvedValue([]);
    conversations = new ConversationsService(
      prisma as never,
      chatPrisma as never,
      redis as never,
    );
  });

  it.each(['root', 'admin', 'manager'] as const)(
    '%s lists every non-deleted conversation in the active company',
    async (role) => {
      await conversations.list(session(role), {});

      expect(chatPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: companyA,
            deletedAt: null,
          }),
        }),
      );
      expect(
        chatPrisma.conversation.findMany.mock.calls[0][0].where,
      ).not.toHaveProperty('userId');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ownerId] } } }),
      );
    },
  );

  it('agents list only their own non-deleted conversations in the active company', async () => {
    await conversations.list(session('agent', ownerId), {});

    expect(chatPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: companyA,
          userId: ownerId,
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('allows managers to detail and read messages owned by another agent in the active company', async () => {
    const result = await conversations.detail(
      session('manager'),
      'conversation-1',
    );
    expect(result).toEqual(expect.objectContaining({ id: 'conversation-1' }));

    await expect(
      conversations.listMessages(session('manager'), 'conversation-1'),
    ).resolves.toEqual([]);
    expect(chatPrisma.conversation.findUnique).toHaveBeenCalledTimes(2);
  });

  it("denies agents detail and messages for another agent's conversation", async () => {
    await expect(
      conversations.detail(session('agent', otherOwnerId), 'conversation-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      conversations.listMessages(
        session('agent', otherOwnerId),
        'conversation-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['different company', conversation({ companyId: companyB })],
    ['deleted', conversation({ deletedAt: new Date() })],
  ] as const)(
    'denies manager detail for a %s conversation',
    async (_label, record) => {
      chatPrisma.conversation.findUnique.mockResolvedValue(record);

      await expect(
        conversations.detail(session('manager'), record.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('keeps summary restricted to root and admin', async () => {
    await expect(
      conversations.summary(session('manager')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps manual replies restricted to root and admin', async () => {
    await expect(
      conversations.createAgentMessage(session('manager'), 'conversation-1', {
        content: 'Reply',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('serializes messages returned through the history read gate', async () => {
    chatPrisma.chatMessage.findMany.mockResolvedValue([
      {
        id: 'message-1',
        content: 'Hello',
        role: MessageRole.user,
        status: MessageStatus.completed,
        parentMessageId: null,
        attemptCount: 0,
        lastError: null,
        model: null,
        provider: null,
        conversationId: 'conversation-1',
        createdAt: new Date('2026-09-01T00:00:00Z'),
      },
    ]);

    await expect(
      conversations.listMessages(session('manager'), 'conversation-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'message-1',
        conversationId: 'conversation-1',
      }),
    ]);
  });
});

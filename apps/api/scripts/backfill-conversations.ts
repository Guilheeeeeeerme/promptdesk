import { PrismaClient } from '@prisma/chat-client';

/**
 * Backfill: groups legacy ChatMessages (conversationId null) into one
 * Conversation per (companyId, userId), titled "Imported chat". Guideline
 * binding fields stay null (snapshots cannot be reconstructed reliably).
 * Idempotent: re-runs are a no-op once no orphan messages remain.
 *
 * Run (not wired into migrations):
 *   cd apps/api && npm run backfill:conversations
 */
async function main(): Promise<void> {
  const chat = new PrismaClient();
  try {
    const groups = await chat.chatMessage.groupBy({
      by: ['companyId', 'userId'],
      where: { conversationId: null },
    });

    if (groups.length === 0) {
      console.log('No orphan chat messages; nothing to backfill.');
      return;
    }

    for (const group of groups) {
      const messages = await chat.chatMessage.findMany({
        where: {
          companyId: group.companyId,
          userId: group.userId,
          conversationId: null,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true },
      });
      if (messages.length === 0) continue;

      const lastMessageAt = messages[messages.length - 1].createdAt;

      const conversation = await chat.conversation.create({
        data: {
          companyId: group.companyId,
          userId: group.userId,
          title: 'Imported chat',
          lastMessageAt,
        },
      });

      await chat.chatMessage.updateMany({
        where: { id: { in: messages.map((m) => m.id) } },
        data: { conversationId: conversation.id },
      });

      console.log(
        `Backfilled ${messages.length} messages -> conversation ${conversation.id} (company=${group.companyId} user=${group.userId})`,
      );
    }
  } finally {
    await chat.$disconnect();
  }
}

void main();

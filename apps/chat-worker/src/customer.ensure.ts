import type { PrismaClient as ChatPrismaClient } from '@prisma/chat-client';
import {
  inferCustomerEmail,
  inferCustomerName,
} from './placeholders';

type ChatDb = Pick<ChatPrismaClient, 'customer' | 'chatMessage'>;

/**
 * Find or create a Customer in the chat DB for this agent+company session.
 * Infers displayName/email from the latest customer message when possible.
 */
export async function ensureCustomerForChat(
  prisma: ChatDb,
  params: {
    companyId: string;
    agentUserId: string;
    messageContent: string;
    userMessageId: string;
    assistantMessageId: string;
  },
): Promise<{ id: string; displayName: string; email: string | null }> {
  const inferredName = inferCustomerName(params.messageContent);
  const inferredEmail = inferCustomerEmail(params.messageContent);

  const existing = await prisma.customer.findFirst({
    where: {
      companyId: params.companyId,
      createdById: params.agentUserId,
    },
    orderBy: { updatedAt: 'desc' },
  });

  let customer =
    existing ??
    (await prisma.customer.create({
      data: {
        companyId: params.companyId,
        createdById: params.agentUserId,
        displayName: inferredName ?? '',
        email: inferredEmail,
      },
    }));

  const patch: { displayName?: string; email?: string } = {};
  if (
    inferredName &&
    customer.displayName.trim().length === 0
  ) {
    patch.displayName = inferredName;
  }
  if (inferredEmail && !customer.email) {
    patch.email = inferredEmail;
  }
  if (Object.keys(patch).length > 0) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: patch,
    });
  }

  await prisma.chatMessage.updateMany({
    where: {
      id: { in: [params.userMessageId, params.assistantMessageId] },
    },
    data: { customerId: customer.id },
  });

  return {
    id: customer.id,
    displayName: customer.displayName,
    email: customer.email,
  };
}

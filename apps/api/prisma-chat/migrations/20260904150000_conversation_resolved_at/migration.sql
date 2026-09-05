-- Resolve-time analytics: when the thread first reached a final state.
ALTER TABLE "Conversation" ADD COLUMN "resolvedAt" TIMESTAMP(3);

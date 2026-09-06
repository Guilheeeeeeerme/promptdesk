export type GuidelineContext = {
  content: string;
  id: string;
  contentHash: string;
};

type ConversationGuidelineSnapshot = {
  guidelineSnapshot: string | null;
  guidelineSnapshotHash: string | null;
  guidelineVersionId: string | null;
};

type LatestGuideline = GuidelineContext | null;

/**
 * Chat generation is isolated to the guideline bound when the conversation
 * started. The latest valid guideline is only a compatibility fallback for
 * conversations created before snapshots were introduced.
 */
export function resolveGuidelineContext(
  conversation: ConversationGuidelineSnapshot,
  latest: LatestGuideline,
): GuidelineContext | null {
  if (
    conversation.guidelineSnapshot !== null &&
    conversation.guidelineSnapshotHash !== null &&
    conversation.guidelineVersionId !== null
  ) {
    return {
      content: conversation.guidelineSnapshot,
      id: conversation.guidelineVersionId,
      contentHash: conversation.guidelineSnapshotHash,
    };
  }

  return latest;
}

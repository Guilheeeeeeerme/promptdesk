import { resolveGuidelineContext } from './guideline-context';

describe('guideline context isolation', () => {
  it('uses the conversation snapshot instead of the latest company guideline', () => {
    expect(
      resolveGuidelineContext(
        {
          guidelineSnapshot: 'Policy from when this chat started',
          guidelineSnapshotHash: 'snapshot-hash',
          guidelineVersionId: 'version-1',
        },
        {
          id: 'version-2',
          content: 'New policy uploaded later',
          contentHash: 'latest-hash',
        },
      ),
    ).toEqual({
      content: 'Policy from when this chat started',
      id: 'version-1',
      contentHash: 'snapshot-hash',
    });
  });

  it('falls back to the latest valid guideline for legacy chats without a snapshot', () => {
    expect(
      resolveGuidelineContext(
        { guidelineSnapshot: null, guidelineSnapshotHash: null, guidelineVersionId: null },
        {
          id: 'version-2',
          content: 'Current policy',
          contentHash: 'latest-hash',
        },
      ),
    ).toEqual({
      content: 'Current policy',
      id: 'version-2',
      contentHash: 'latest-hash',
    });
  });
});

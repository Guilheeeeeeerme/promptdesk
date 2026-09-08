import type { BannerTone } from '@shared/ui';
import { Banner } from '@shared/ui';

export type FeedbackTone = 'info' | 'success' | 'error';

export interface Feedback {
  tone: FeedbackTone;
  message: string;
}

const TONE_MAP: Record<FeedbackTone, BannerTone> = {
  info: 'info',
  success: 'success',
  error: 'error',
};

export function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;

  return (
    <Banner tone={TONE_MAP[feedback.tone]} className="mb-4">
      {feedback.message}
    </Banner>
  );
}

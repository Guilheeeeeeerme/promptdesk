export type FeedbackTone = 'info' | 'success' | 'error';

export interface Feedback {
  tone: FeedbackTone;
  message: string;
}

const STYLES: Record<FeedbackTone, string> = {
  info: 'bg-sky-50 border-sky-200 text-sky-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
};

export function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;

  return (
    <div
      className={`mb-4 rounded-md border px-4 py-3 text-sm ${STYLES[feedback.tone]}`}
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {feedback.message}
    </div>
  );
}

/**
 * Neutralization of untrusted text before it is fenced into a prompt.
 *
 * Fencing only holds if the payload cannot emit the fence markers itself: a
 * guideline or customer message containing END_UNTRUSTED_SUPPORT_CONTEXT would
 * otherwise close the data block early and have the rest of its text read as
 * instructions (OWASP LLM01).
 */

const FENCE_MARKERS = /(BEGIN|END)_UNTRUSTED_SUPPORT_CONTEXT/g;

/**
 * Invisible to a reviewer, visible to the model: Unicode tag block (smuggled
 * ASCII), zero-width characters, and bidi overrides. OWASP LLM01 lists these
 * as the encoding axis of prompt injection.
 */
const INVISIBLE_CHARS =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}]/gu;

/** Strip invisible characters and defang fence markers in untrusted text. */
export function neutralizeUntrusted(text: string): string {
  return text
    .replace(INVISIBLE_CHARS, '')
    .replace(FENCE_MARKERS, '$1_UNTRUSTED_SUPPORT_CONTEXT_NEUTRALIZED');
}

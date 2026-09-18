/**
 * Headroom LLM proxy switch for Gemini + OpenAI.
 *
 * LLM_USE_HEADROOM=true  → use GEMINI_BASE_URL / OPENAI_BASE_URL (typically Headroom)
 * LLM_USE_HEADROOM=false → force public Google/OpenAI URLs even if env still points at Headroom
 */
const HEADROOM_HINT = /headroom|:8787\b/i;

export const DEFAULT_GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const HEADROOM_GEMINI_BASE_URL = "http://headroom:8787";
export const HEADROOM_OPENAI_BASE_URL = "http://headroom:8787/v1";

export function llmUseHeadroom(
  raw: string | undefined | null,
  fallback = true,
): boolean {
  if (raw == null || raw === "") return fallback;
  return raw !== "false" && raw !== "0";
}

function looksLikeHeadroom(url: string): boolean {
  return HEADROOM_HINT.test(url);
}

/** Resolved Gemini root (no trailing slash). Undefined → SDK/public default. */
export function resolveGeminiBaseUrl(
  useHeadroomFlag: string | undefined | null,
  configured: string | undefined | null,
): string | undefined {
  const on = llmUseHeadroom(useHeadroomFlag, true);
  const raw = (configured || "").trim().replace(/\/$/, "");
  if (!on) {
    if (!raw || looksLikeHeadroom(raw)) return undefined;
    return raw;
  }
  if (!raw) return HEADROOM_GEMINI_BASE_URL;
  return raw;
}

/** Resolved OpenAI-compatible baseURL. Undefined → official OpenAI default. */
export function resolveOpenAiBaseUrl(
  useHeadroomFlag: string | undefined | null,
  configured: string | undefined | null,
): string | undefined {
  const on = llmUseHeadroom(useHeadroomFlag, true);
  const raw = (configured || "").trim().replace(/\/$/, "");
  if (!on) {
    if (!raw || looksLikeHeadroom(raw)) return undefined;
    return raw;
  }
  if (!raw) return HEADROOM_OPENAI_BASE_URL;
  return raw;
}

/** Absolute URL base for fetch() helpers (always a concrete string). */
export function resolveGeminiBaseUrlOrDefault(
  useHeadroomFlag: string | undefined | null,
  configured: string | undefined | null,
): string {
  return (
    resolveGeminiBaseUrl(useHeadroomFlag, configured) || DEFAULT_GEMINI_BASE_URL
  );
}

export function resolveOpenAiBaseUrlOrDefault(
  useHeadroomFlag: string | undefined | null,
  configured: string | undefined | null,
): string {
  return (
    resolveOpenAiBaseUrl(useHeadroomFlag, configured) || DEFAULT_OPENAI_BASE_URL
  );
}

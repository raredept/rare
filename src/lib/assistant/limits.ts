// RARE Assistant — size limits (no dependencies, safe to import from client components).

export const ASSISTANT_LIMITS = {
  displayName: 80,
  welcomeMessage: 500,
  inputPlaceholder: 120,
  fallbackMessage: 500,
  supportCtaLabel: 60,
  supportCtaHref: 300,
  question: 300,
  answer: 2000,
  category: 80,
  keyword: 80,
  keywords: 30,
  sortOrder: 9999,
  message: 500,
  suggestions: 4,
} as const;

/** Public request body cap: a 500-character message is far below it even fully escaped. */
export const ASSISTANT_REQUEST_MAX_BYTES = 4 * 1024;
/** Public endpoint: questions per client address per window (the limiter hashes the key). */
export const ASSISTANT_RATE_LIMIT = 30;
export const ASSISTANT_RATE_WINDOW_MS = 60_000;

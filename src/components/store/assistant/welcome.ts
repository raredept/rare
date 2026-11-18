// RARE-ASSISTANT-UIUX-02: presentation helpers for the assistant panel. Pure functions, no copy of
// their own: everything shown comes from the Admin configuration.

/** Longest opening line that still reads as a headline in a 320 px panel. */
export const WELCOME_LEAD_MAX = 48;

/**
 * Splits the Admin's welcome message into an editorial headline (its own first line or first short
 * sentence, e.g. "Oi!") and the rest. Nothing is added or rewritten, so a greeting is never
 * duplicated; a message without a short opening is shown whole, as body text.
 */
export function splitWelcomeMessage(message: string): { lead: string | null; body: string } {
  const value = message.trim();
  if (!value) return { lead: null, body: "" };
  const newline = value.indexOf("\n");
  if (newline > 0) {
    const firstLine = value.slice(0, newline).trim();
    if (firstLine && firstLine.length <= WELCOME_LEAD_MAX) return { lead: firstLine, body: value.slice(newline + 1).trim() };
  }
  // First sentence of the first line ("Oi! Posso ajudar…" → "Oi!").
  const sentence = /^([^\n]+?[.!?…])[ \t]+(?=\S)/.exec(value);
  if (sentence && sentence[1].length <= WELCOME_LEAD_MAX) return { lead: sentence[1], body: value.slice(sentence[0].length).trim() };
  // A single short sentence is the headline on its own.
  if (newline < 0 && value.length <= WELCOME_LEAD_MAX) return { lead: value, body: "" };
  return { lead: null, body: value };
}

type Role = "user" | "assistant";

/**
 * Author labels ("Você" / "RARE") appear on the first message of each author only: enough to read
 * who is who without repeating a label on every bubble.
 */
export function firstOfEachRole<T extends { role: Role }>(messages: readonly T[]): Set<T> {
  const seen = new Set<Role>();
  const labelled = new Set<T>();
  for (const message of messages) {
    if (seen.has(message.role)) continue;
    seen.add(message.role);
    labelled.add(message);
  }
  return labelled;
}

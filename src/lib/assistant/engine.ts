import { matchAssistantEntry, type AssistantMatchEntry, type AssistantMatchReason } from "@/lib/assistant/matching";

// RARE Assistant — the answering engine behind one small interface. Version 1 is deterministic and
// answers only with content the Admin wrote (GENERATIVE_AI=NO, EXTERNAL_LLM_API=NO). A future engine
// (for example one that rephrases or retrieves with a model) can implement the same interface
// without touching the storefront widget, the public endpoint contract or the Admin.

export type AssistantEngineInput<Entry extends AssistantMatchEntry> = {
  message: string;
  entries: readonly Entry[];
};

export type AssistantEngineAnswer<Entry extends AssistantMatchEntry> =
  | { kind: "answer"; entry: Entry; text: string; category: string | null; confidence: number; reason: AssistantMatchReason; runnerUp: { entry: Entry; score: number } | null }
  | { kind: "fallback"; confidence: number; closest: { entry: Entry; score: number } | null };

export interface AssistantEngine {
  readonly id: string;
  answer<Entry extends AssistantMatchEntry>(input: AssistantEngineInput<Entry>): AssistantEngineAnswer<Entry>;
}

export const deterministicAssistantEngine: AssistantEngine = {
  id: "deterministic-v1",
  answer(input) {
    const result = matchAssistantEntry(input.message, input.entries);
    if (!result.matched) return { kind: "fallback", confidence: result.score, closest: result.best };
    return {
      kind: "answer",
      entry: result.entry,
      text: result.entry.answer,
      category: result.entry.category,
      confidence: result.score,
      reason: result.reason,
      runnerUp: result.runnerUp,
    };
  },
};

/** The engine in use. Swapping engines is a one-line change here (plus its own tests). */
export function getAssistantEngine(): AssistantEngine {
  return deterministicAssistantEngine;
}

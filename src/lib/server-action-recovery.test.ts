import { describe, expect, it, vi } from "vitest";
import { shouldOfferServerActionRefresh } from "@/lib/server-action-recovery";

describe("Server Action recovery", () => {
  it("offers a manual refresh only when Next classifies an unrecognized action", () => {
    const error = new Error("stale deployment");
    const classifier = vi.fn((candidate: unknown) => candidate === error);

    expect(shouldOfferServerActionRefresh(error, classifier)).toBe(true);
    expect(shouldOfferServerActionRefresh(new Error("validation"), classifier)).toBe(false);
  });
});

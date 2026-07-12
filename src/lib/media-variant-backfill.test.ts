import { describe, expect, it, vi } from "vitest";
import {
  createMediaVariantBackfillProcessor,
  getSafeMediaBackfillFailureReason,
  planMediaVariantBackfill,
  runMediaVariantBackfill,
  type MediaBackfillCandidate,
  type MediaBackfillStorage,
} from "@/lib/media-variant-backfill";

async function* candidates(values: MediaBackfillCandidate[]) {
  for (const value of values) yield value;
}

function createStorage(initialUrls: string[] = []) {
  const objects = new Map(initialUrls.map((url) => [url, Buffer.from("existing")]));
  const storage: MediaBackfillStorage = {
    exists: vi.fn(async (url) => objects.has(url)),
    read: vi.fn(async () => Buffer.from("source")),
    putIfAbsent: vi.fn(async (url, bytes) => {
      if (objects.has(url)) return "exists" as const;
      objects.set(url, bytes);
      return "created" as const;
    }),
  };
  return { storage, objects };
}

const candidate: MediaBackfillCandidate = {
  id: "image-1",
  field: "product-image",
  url: "/uploads/products/legacy.png",
};

describe("media variant backfill", () => {
  it("creates deterministic targets while keeping the original object URL", () => {
    expect(planMediaVariantBackfill(candidate.url)).toEqual({
      eligible: true,
      markedUrl: "/uploads/products/legacy.png?rare-media-variants=v1",
      variantUrls: [
        "/uploads/products/legacy-rare-v1-thumbnail.webp",
        "/uploads/products/legacy-rare-v1-medium.webp",
      ],
    });
  });

  it("does not call storage or update references in dry-run mode", async () => {
    const process = vi.fn();
    const updateReference = vi.fn();

    const summary = await runMediaVariantBackfill({
      candidates: candidates([candidate]),
      limit: 10,
      dryRun: true,
      process,
      updateReference,
    });

    expect(summary).toEqual(expect.objectContaining({ selected: 1, planned: 1, completed: 0 }));
    expect(process).not.toHaveBeenCalled();
    expect(updateReference).not.toHaveBeenCalled();
  });

  it("creates only missing variants and becomes idempotent", async () => {
    const plan = planMediaVariantBackfill(candidate.url);
    const { storage } = createStorage([plan.variantUrls![0]]);
    const generate = vi.fn(async () => ({
      sourceWidth: 1600,
      sourceHeight: 1200,
      variants: [
        { kind: "thumbnail" as const, bytes: Buffer.from("thumb"), contentType: "image/webp" as const, width: 640, height: 480 },
        { kind: "medium" as const, bytes: Buffer.from("medium"), contentType: "image/webp" as const, width: 1200, height: 900 },
      ],
    }));
    const process = createMediaVariantBackfillProcessor(storage, { maxSourceBytes: 1024, generate });

    const first = await process(candidate);
    const second = await process(candidate);

    expect(first).toEqual(expect.objectContaining({ status: "complete", createdVariants: 1, existingVariants: 1 }));
    expect(second).toEqual(expect.objectContaining({ status: "complete", createdVariants: 0, existingVariants: 2 }));
    expect(storage.putIfAbsent).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("updates the database reference only after a complete variant set", async () => {
    const updateReference = vi.fn();
    const process = vi.fn(async () => ({
      status: "complete" as const,
      markedUrl: "/uploads/products/legacy.png?rare-media-variants=v1",
      createdVariants: 2,
      existingVariants: 0,
    }));

    const summary = await runMediaVariantBackfill({
      candidates: candidates([candidate]),
      limit: 1,
      dryRun: false,
      process,
      updateReference,
    });

    expect(updateReference).toHaveBeenCalledWith(candidate, "/uploads/products/legacy.png?rare-media-variants=v1");
    expect(summary.completed).toBe(1);
  });

  it("continues after an individual failure and respects the batch limit", async () => {
    const second = { ...candidate, id: "image-2", url: "/uploads/products/second.jpg" };
    const third = { ...candidate, id: "image-3", url: "/uploads/products/third.webp" };
    const process = vi
      .fn()
      .mockRejectedValueOnce(new Error("broken-source"))
      .mockResolvedValueOnce({
        status: "complete",
        markedUrl: "/uploads/products/second.jpg?rare-media-variants=v1",
        createdVariants: 2,
        existingVariants: 0,
      });
    const updateReference = vi.fn();

    const summary = await runMediaVariantBackfill({
      candidates: candidates([candidate, second, third]),
      limit: 2,
      dryRun: false,
      process,
      updateReference,
    });

    expect(process).toHaveBeenCalledTimes(2);
    expect(updateReference).toHaveBeenCalledTimes(1);
    expect(summary).toEqual(expect.objectContaining({ selected: 2, completed: 1, failed: 1 }));
  });

  it("rejects signed or query-bearing legacy URLs", () => {
    expect(planMediaVariantBackfill("https://media.example/photo.png?token=secret")).toEqual({
      eligible: false,
      reason: "query-or-fragment-not-supported",
    });
  });

  it("does not expose unexpected provider error messages in progress logs", () => {
    expect(getSafeMediaBackfillFailureReason(new Error("request failed for https://bucket.example/key?token=secret"))).toBe(
      "unexpected-error",
    );
    expect(getSafeMediaBackfillFailureReason(new Error("source-exceeds-configured-size-limit"))).toBe(
      "source-exceeds-configured-size-limit",
    );
  });

  it.each([
    ["original missing", Object.assign(new Error("missing"), { code: "ENOENT" })],
    ["source too large", new Error("source-exceeds-configured-size-limit")],
    ["corrupted image", new Error("corrupted-image")],
  ])("contains an individual %s failure without updating the reference", async (_label, failure) => {
    const { storage } = createStorage();
    vi.mocked(storage.read).mockRejectedValueOnce(failure);
    const updateReference = vi.fn();
    const summary = await runMediaVariantBackfill({
      candidates: candidates([candidate]),
      limit: 1,
      dryRun: false,
      process: createMediaVariantBackfillProcessor(storage, { maxSourceBytes: 10 }),
      updateReference,
    });
    expect(summary.failed).toBe(1);
    expect(updateReference).not.toHaveBeenCalled();
  });

  it("reports interruption after the current item and does not start the next one", async () => {
    const controller = new AbortController();
    const second = { ...candidate, id: "image-2", url: "/uploads/products/second.jpg" };
    const process = vi.fn(async () => {
      controller.abort();
      return { status: "skipped" as const, reason: "source-not-eligible-for-variants" };
    });
    const summary = await runMediaVariantBackfill({
      candidates: candidates([candidate, second]),
      limit: 2,
      dryRun: false,
      process,
      updateReference: vi.fn(),
      signal: controller.signal,
    });
    expect(summary.interrupted).toBe(true);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("does not mark completion when the database reference changed concurrently", async () => {
    const updateReference = vi.fn(async () => { throw new Error("media-reference-changed-concurrently"); });
    const summary = await runMediaVariantBackfill({
      candidates: candidates([candidate]),
      limit: 1,
      dryRun: false,
      process: vi.fn(async () => ({ status: "complete" as const, markedUrl: "marked", createdVariants: 2, existingVariants: 0 })),
      updateReference,
    });
    expect(summary).toEqual(expect.objectContaining({ completed: 0, failed: 1 }));
  });
});

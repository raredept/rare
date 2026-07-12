import { generateStaticImageVariants } from "@/lib/image-variants";
import {
  GENERATED_MEDIA_VARIANTS,
  getGeneratedMediaVariantsFromUrl,
  hasGeneratedMediaVariants,
  markBackfilledMediaUrl,
} from "@/lib/media-variant-convention";

export type MediaBackfillField = "product-image" | "banner-desktop" | "banner-mobile";

export type MediaBackfillCandidate = {
  id: string;
  field: MediaBackfillField;
  url: string;
};

export type MediaBackfillStorage = {
  exists(url: string): Promise<boolean>;
  read(url: string, maxBytes: number): Promise<Buffer>;
  putIfAbsent(url: string, bytes: Buffer, contentType: "image/webp"): Promise<"created" | "exists">;
};

export type MediaBackfillProcessResult =
  | { status: "complete"; markedUrl: string; createdVariants: number; existingVariants: number }
  | { status: "skipped"; reason: string };

export type MediaBackfillSummary = {
  selected: number;
  planned: number;
  completed: number;
  alreadyComplete: number;
  skipped: number;
  failed: number;
  createdVariants: number;
  interrupted: boolean;
};

export type MediaBackfillPlan = {
  eligible: boolean;
  reason?: string;
  markedUrl?: string;
  variantUrls?: string[];
};

const supportedExtensionPattern = /\.(?:jpe?g|png|webp|avif)$/i;
const safeFailureReasons = new Set([
  "invalid-media-object-key",
  "media-reference-changed-concurrently",
  "media-url-outside-configured-storage",
  "source-exceeds-configured-size-limit",
  "source-object-body-missing",
  "variant-set-incomplete-after-write",
]);

export function getSafeMediaBackfillFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (safeFailureReasons.has(message)) return message;

  const name = error instanceof Error ? error.name : "UnknownError";
  const normalizedName = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return normalizedName ? `unexpected-${normalizedName}` : "unexpected-error";
}

export function planMediaVariantBackfill(url: string): MediaBackfillPlan {
  if (hasGeneratedMediaVariants(url)) {
    return { eligible: false, reason: "already-complete" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url, "https://rare.local");
  } catch {
    return { eligible: false, reason: "invalid-url" };
  }

  if (parsed.search || parsed.hash) {
    return { eligible: false, reason: "query-or-fragment-not-supported" };
  }

  if (!supportedExtensionPattern.test(parsed.pathname)) {
    return { eligible: false, reason: "unsupported-media-type" };
  }

  const markedUrl = markBackfilledMediaUrl(url);
  const variantUrls = getGeneratedMediaVariantsFromUrl(markedUrl).map((variant) => variant.url);
  if (variantUrls.length !== GENERATED_MEDIA_VARIANTS.length) {
    return { eligible: false, reason: "variant-plan-unavailable" };
  }

  return { eligible: true, markedUrl, variantUrls };
}

export function createMediaVariantBackfillProcessor(
  storage: MediaBackfillStorage,
  options: {
    maxSourceBytes: number;
    generate?: typeof generateStaticImageVariants;
  },
) {
  const generate = options.generate ?? generateStaticImageVariants;

  return async (candidate: MediaBackfillCandidate): Promise<MediaBackfillProcessResult> => {
    const plan = planMediaVariantBackfill(candidate.url);
    if (!plan.eligible || !plan.markedUrl || !plan.variantUrls) {
      return { status: "skipped", reason: plan.reason ?? "not-eligible" };
    }

    const existing = await Promise.all(plan.variantUrls.map((url) => storage.exists(url)));
    if (existing.every(Boolean)) {
      return {
        status: "complete",
        markedUrl: plan.markedUrl,
        createdVariants: 0,
        existingVariants: existing.length,
      };
    }

    const source = await storage.read(candidate.url, options.maxSourceBytes);
    const generated = await generate(source);
    if (!generated) {
      return { status: "skipped", reason: "source-not-eligible-for-variants" };
    }

    let createdVariants = 0;
    let existingVariants = 0;
    for (const [index, generatedVariant] of generated.variants.entries()) {
      if (existing[index]) {
        existingVariants += 1;
        continue;
      }

      const outcome = await storage.putIfAbsent(
        plan.variantUrls[index],
        generatedVariant.bytes,
        generatedVariant.contentType,
      );
      if (outcome === "created") createdVariants += 1;
      else existingVariants += 1;
    }

    const complete = await Promise.all(plan.variantUrls.map((url) => storage.exists(url)));
    if (!complete.every(Boolean)) {
      throw new Error("variant-set-incomplete-after-write");
    }

    return {
      status: "complete",
      markedUrl: plan.markedUrl,
      createdVariants,
      existingVariants,
    };
  };
}

export async function runMediaVariantBackfill(options: {
  candidates: AsyncIterable<MediaBackfillCandidate>;
  limit: number;
  dryRun: boolean;
  process: (candidate: MediaBackfillCandidate) => Promise<MediaBackfillProcessResult>;
  updateReference: (candidate: MediaBackfillCandidate, markedUrl: string) => Promise<void>;
  log?: (message: string) => void;
  signal?: AbortSignal;
}) {
  const summary: MediaBackfillSummary = {
    selected: 0,
    planned: 0,
    completed: 0,
    alreadyComplete: 0,
    skipped: 0,
    failed: 0,
    createdVariants: 0,
    interrupted: false,
  };
  const log = options.log ?? (() => undefined);

  for await (const candidate of options.candidates) {
    if (options.signal?.aborted) {
      summary.interrupted = true;
      break;
    }
    if (summary.selected >= options.limit) break;

    const plan = planMediaVariantBackfill(candidate.url);
    if (plan.reason === "already-complete") {
      summary.alreadyComplete += 1;
      continue;
    }

    summary.selected += 1;
    const label = `${candidate.field}:${candidate.id}`;

    if (options.dryRun) {
      if (plan.eligible) {
        summary.planned += 1;
        log(`[${summary.selected}/${options.limit}] planned ${label}`);
      } else {
        summary.skipped += 1;
        log(`[${summary.selected}/${options.limit}] skipped ${label} reason=${plan.reason}`);
      }
      continue;
    }

    try {
      const result = await options.process(candidate);
      if (result.status === "skipped") {
        summary.skipped += 1;
        log(`[${summary.selected}/${options.limit}] skipped ${label} reason=${result.reason}`);
        continue;
      }

      await options.updateReference(candidate, result.markedUrl);
      summary.completed += 1;
      summary.createdVariants += result.createdVariants;
      log(
        `[${summary.selected}/${options.limit}] complete ${label} created=${result.createdVariants} existing=${result.existingVariants}`,
      );
    } catch (error) {
      summary.failed += 1;
      const reason = getSafeMediaBackfillFailureReason(error);
      log(`[${summary.selected}/${options.limit}] failed ${label} reason=${reason}`);
    }

    if (options.signal?.aborted) {
      summary.interrupted = true;
      break;
    }
  }

  return summary;
}

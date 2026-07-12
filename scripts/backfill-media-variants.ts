import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  createMediaVariantBackfillProcessor,
  planMediaVariantBackfill,
  runMediaVariantBackfill,
  type MediaBackfillCandidate,
} from "../src/lib/media-variant-backfill";
import { createConfiguredMediaBackfillStorage } from "../src/lib/media-variant-backfill-storage";
import { assertProductionMediaBackfillAuthorized, parseMediaBackfillArgs } from "../src/lib/media-backfill-cli";

const PAGE_SIZE = 50;

function sanitizeFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : "Media variant backfill failed.";
  return message
    .split("\n", 1)[0]
    .replace(/[a-z]+:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/\b(?:sk_(?:live|test)|whsec|Bearer)[A-Za-z0-9_.-]+/gi, "[redacted-token]");
}


function isEligible(url: string) {
  return planMediaVariantBackfill(url).eligible;
}

async function* findCandidates(): AsyncGenerator<MediaBackfillCandidate> {
  let productCursor: string | undefined;
  while (true) {
    const rows = await prisma.productImage.findMany({
      take: PAGE_SIZE,
      orderBy: { id: "asc" },
      ...(productCursor ? { cursor: { id: productCursor }, skip: 1 } : {}),
      select: { id: true, url: true },
    });
    if (!rows.length) break;

    for (const row of rows) {
      if (isEligible(row.url)) yield { id: row.id, field: "product-image", url: row.url };
    }
    productCursor = rows.at(-1)!.id;
    if (rows.length < PAGE_SIZE) break;
  }

  let bannerCursor: string | undefined;
  while (true) {
    const rows = await prisma.homeBannerSlide.findMany({
      take: PAGE_SIZE,
      orderBy: { id: "asc" },
      ...(bannerCursor ? { cursor: { id: bannerCursor }, skip: 1 } : {}),
      select: { id: true, imageUrl: true, mobileImageUrl: true },
    });
    if (!rows.length) break;

    for (const row of rows) {
      if (row.imageUrl && isEligible(row.imageUrl)) {
        yield { id: row.id, field: "banner-desktop", url: row.imageUrl };
      }
      if (row.mobileImageUrl && isEligible(row.mobileImageUrl)) {
        yield { id: row.id, field: "banner-mobile", url: row.mobileImageUrl };
      }
    }
    bannerCursor = rows.at(-1)!.id;
    if (rows.length < PAGE_SIZE) break;
  }
}

async function updateReference(candidate: MediaBackfillCandidate, markedUrl: string) {
  if (candidate.field === "product-image") {
    const result = await prisma.productImage.updateMany({
      where: { id: candidate.id, url: candidate.url },
      data: { url: markedUrl },
    });
    if (result.count !== 1) throw new Error("media-reference-changed-concurrently");
    return;
  }

  const result = await prisma.homeBannerSlide.updateMany({
    where:
      candidate.field === "banner-desktop"
        ? { id: candidate.id, imageUrl: candidate.url }
        : { id: candidate.id, mobileImageUrl: candidate.url },
    data:
      candidate.field === "banner-desktop"
        ? { imageUrl: markedUrl }
        : { mobileImageUrl: markedUrl },
  });
  if (result.count !== 1) throw new Error("media-reference-changed-concurrently");
}

async function main() {
  const args = parseMediaBackfillArgs(process.argv.slice(2));
  assertProductionMediaBackfillAuthorized(args);
  const abortController = new AbortController();
  let interruptedSignal: NodeJS.Signals | null = null;
  const interrupt = (signal: NodeJS.Signals) => {
    interruptedSignal = signal;
    abortController.abort();
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);

  console.log("Media variant backfill");
  console.log(`Mode: ${args.dryRun ? "dry-run (default, no writes)" : "apply"}`);
  console.log(`Batch limit: ${args.limit}`);

  const processCandidate = args.dryRun
    ? async () => {
        throw new Error("dry-run-processor-must-not-run");
      }
    : createMediaVariantBackfillProcessor(createConfiguredMediaBackfillStorage(), {
        maxSourceBytes: args.maxSourceBytes,
      });

  const summary = await runMediaVariantBackfill({
    candidates: findCandidates(),
    limit: args.limit,
    dryRun: args.dryRun,
    process: processCandidate,
    updateReference,
    log: console.log,
    signal: abortController.signal,
  });

  console.log("Summary:");
  console.log(JSON.stringify(summary));
  if (interruptedSignal) process.exitCode = interruptedSignal === "SIGINT" ? 130 : 143;
  else if (summary.failed > 0) process.exitCode = 1;
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
}

main()
  .catch((error) => {
    console.error(sanitizeFatalError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

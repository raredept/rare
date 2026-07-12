import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  createMediaVariantBackfillProcessor,
  planMediaVariantBackfill,
  runMediaVariantBackfill,
  type MediaBackfillCandidate,
} from "../src/lib/media-variant-backfill";
import { createConfiguredMediaBackfillStorage } from "../src/lib/media-variant-backfill-storage";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_MAX_SOURCE_MB = 25;
const PAGE_SIZE = 50;

type Args = {
  limit: number;
  dryRun: boolean;
  maxSourceBytes: number;
};

function sanitizeFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : "Media variant backfill failed.";
  return message
    .split("\n", 1)[0]
    .replace(/[a-z]+:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/\b(?:sk_(?:live|test)|whsec|Bearer)[A-Za-z0-9_.-]+/gi, "[redacted-token]");
}

function getArgumentValue(argv: string[], name: string) {
  const inline = argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseMediaBackfillArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): Args {
  const applying = argv.includes("--apply");
  if (applying && argv.includes("--dry-run")) {
    throw new Error("Use --dry-run ou --apply, nunca os dois juntos.");
  }

  const rawLimit = getArgumentValue(argv, "--limit") ?? String(DEFAULT_LIMIT);
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`--limit deve ser um inteiro entre 1 e ${MAX_LIMIT}.`);
  }

  const rawMaxSourceMb = env.MEDIA_BACKFILL_MAX_SOURCE_MB ?? String(DEFAULT_MAX_SOURCE_MB);
  const maxSourceMb = Number(rawMaxSourceMb);
  if (!Number.isFinite(maxSourceMb) || maxSourceMb <= 0 || maxSourceMb > 100) {
    throw new Error("MEDIA_BACKFILL_MAX_SOURCE_MB deve ser um número entre 0 e 100.");
  }

  return {
    limit,
    dryRun: !applying,
    maxSourceBytes: Math.floor(maxSourceMb * 1024 * 1024),
  };
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

function assertProductionApplyAuthorized(args: Args, env: NodeJS.ProcessEnv = process.env) {
  const environment = (env.APP_ENV ?? env.NODE_ENV ?? "development").toLowerCase();
  if (!args.dryRun && environment === "production" && env.MEDIA_BACKFILL_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Backfill em produção bloqueado. Exige autorização explícita e MEDIA_BACKFILL_ALLOW_PRODUCTION=true somente durante a execução aprovada.",
    );
  }
}

async function main() {
  const args = parseMediaBackfillArgs(process.argv.slice(2));
  assertProductionApplyAuthorized(args);

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
  });

  console.log("Summary:");
  console.log(JSON.stringify(summary));
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(sanitizeFatalError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

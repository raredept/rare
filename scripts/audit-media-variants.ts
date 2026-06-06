import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  buildBannerMediaVariantAuditEntries,
  buildMediaVariantAuditReport,
  buildProductMediaVariantAuditEntries,
  isPossiblySignedMediaUrl,
  maskMediaUrl,
  type MediaVariantAuditEntry,
  type MediaVariantAuditItem,
} from "../src/lib/media-variant-audit";

type Args = {
  checkRemoteSize: boolean;
};

function parseArgs(argv: string[]): Args {
  return {
    checkRemoteSize: argv.includes("--check-remote-size"),
  };
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "unknown";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function getRemoteSizeBytes(url: string) {
  if (!isHttpUrl(url)) return null;
  if (isPossiblySignedMediaUrl(url)) return null;

  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
  });

  if (!response.ok) return null;

  const contentLength = response.headers.get("content-length");
  const size = contentLength ? Number(contentLength) : null;
  return typeof size === "number" && Number.isFinite(size) && size >= 0 ? size : null;
}

async function withRemoteSizes(entries: MediaVariantAuditEntry[], enabled: boolean) {
  if (!enabled) return entries;

  const enriched: MediaVariantAuditEntry[] = [];
  for (const entry of entries) {
    const knownSizeBytes = entry.knownSizeBytes ?? (await getRemoteSizeBytes(entry.url));
    enriched.push({ ...entry, knownSizeBytes });
  }

  return enriched;
}

function sourceLabel(item: MediaVariantAuditItem) {
  const source = item.source === "product" ? "product" : "banner";
  const slug = item.ownerSlug ? `/${item.ownerSlug}` : "";
  return `${source}:${item.ownerTitle}${slug}`;
}

function printItem(item: MediaVariantAuditItem) {
  const activeLabel = item.ownerActive ? "active" : "inactive";
  const usages = item.usages.join(",");
  const size = formatBytes(item.knownSizeBytes);
  console.log(
    `- ${sourceLabel(item)} | ${item.field} | ${activeLabel} | ${item.mediaType}/${item.extension || "unknown"} | ` +
      `status=${item.status} | priority=${item.priority} | usages=${usages} | size=${size}`,
  );
  console.log(`  url=${item.safeUrl}`);
  console.log(`  reason=${item.reason}`);
}

function printSection(title: string, items: MediaVariantAuditItem[], limit = 50) {
  console.log("");
  console.log(title);

  if (!items.length) {
    console.log("- none");
    return;
  }

  for (const item of items.slice(0, limit)) {
    printItem(item);
  }

  if (items.length > limit) {
    console.log(`- ... ${items.length - limit} additional item(s) omitted from console output.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const [products, banners] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        active: true,
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            url: true,
            alt: true,
            sortOrder: true,
          },
        },
      },
    }),
    prisma.homeBannerSlide.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        active: true,
        sortOrder: true,
        imageUrl: true,
        mobileImageUrl: true,
      },
    }),
  ]);

  const entries = [
    ...buildProductMediaVariantAuditEntries(products),
    ...buildBannerMediaVariantAuditEntries(banners),
  ];
  const entriesWithSizes = await withRemoteSizes(entries, args.checkRemoteSize);
  const report = buildMediaVariantAuditReport(entriesWithSizes);

  console.log("Media variants audit (dry-run)");
  console.log("Mode: read-only; no database writes; no R2 writes; no variant generation; no deletion.");
  console.log(
    args.checkRemoteSize
      ? "Remote size check: enabled via HEAD for unsigned http(s) URLs only."
      : "Remote size check: disabled. No external network calls were made for file sizes.",
  );
  console.log(`Products checked: ${products.length}`);
  console.log(`Banners checked: ${banners.length}`);
  console.log(`Total media: ${report.summary.totalMedia}`);
  console.log(`With variants: ${report.summary.totalWithVariants}`);
  console.log(`Without variants: ${report.summary.totalWithoutVariants}`);
  console.log(`Manual reupload candidates: ${report.summary.totalReuploadCandidates}`);
  console.log(`Preserved originals (GIF/MP4): ${report.summary.totalPreservedOriginal}`);
  console.log(`Large originals (known size): ${report.summary.totalLargeOriginal}`);
  console.log(`Unknown size: ${report.summary.totalUnknownSize}`);

  printSection(
    "Manual reupload candidates",
    [...report.reuploadCandidates].sort((first, second) => {
      const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
      return priorityOrder[first.priority] - priorityOrder[second.priority] || sourceLabel(first).localeCompare(sourceLabel(second));
    }),
  );
  printSection("Preserve original (GIF/MP4)", report.preservedOriginal);

  const signedOrQueryUrls = report.items.filter((item) => item.url !== maskMediaUrl(item.url) && item.url.includes("?"));
  if (signedOrQueryUrls.length) {
    console.log("");
    console.log(`Sanitized URLs: ${signedOrQueryUrls.length} media URL(s) contained query strings or signatures and were masked.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Media variants audit failed.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

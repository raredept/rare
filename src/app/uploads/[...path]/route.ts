import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getStorageDriver } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentTypeByExtension = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".mp4", "video/mp4"],
]);

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isSafeSegment(segment: string) {
  return Boolean(segment) && segment !== "." && segment !== ".." && !segment.includes("/") && !segment.includes("\\") && !segment.includes("\0");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    if (getStorageDriver() !== "local") {
      return notFound();
    }
  } catch {
    return notFound();
  }

  const { path: filePath } = await params;
  if (!filePath.length || !filePath.every(isSafeSegment)) {
    return notFound();
  }

  const extension = path.extname(filePath[filePath.length - 1]).toLowerCase();
  const contentType = contentTypeByExtension.get(extension);
  if (!contentType) {
    return notFound();
  }

  const storageRoot = path.join(process.cwd(), "public", "uploads");
  const absolutePath = path.resolve(storageRoot, ...filePath);
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    return notFound();
  }

  try {
    const bytes = await readFile(absolutePath);
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizePublicIdentifier, sanitizeReleaseSha } from "./server-action-observability";

export function getReleaseArtifact() {
  try {
    const manifest = JSON.parse(readFileSync(path.join(process.cwd(), ".next", "release-manifest.json"), "utf8"));
    const digest = typeof manifest.sourceSha256 === "string" && /^[a-f0-9]{64}$/.test(manifest.sourceSha256)
      ? manifest.sourceSha256 : null;
    return {
      commitSha: sanitizeReleaseSha(manifest.commitSha ?? undefined),
      nextBuildId: sanitizePublicIdentifier(manifest.nextBuildId),
      sourceSha256: digest,
    };
  } catch {
    return { commitSha: null, nextBuildId: null, sourceSha256: null };
  }
}

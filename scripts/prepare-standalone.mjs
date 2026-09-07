import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isReleaseSourcePath, releaseSourceManifest } from "./release-source-manifest.mjs";

const nextDir = path.resolve(".next");
const standaloneDir = path.join(nextDir, "standalone");

await mkdir(path.join(standaloneDir, ".next"), { recursive: true });
await cp(path.join(nextDir, "static"), path.join(standaloneDir, ".next", "static"), { recursive: true });
await cp("public", path.join(standaloneDir, "public"), {
  recursive: true,
  filter: (source) => isReleaseSourcePath(path.relative(process.cwd(), source)),
});

const sha = process.env.RAILWAY_GIT_COMMIT_SHA;
const manifest = {
  schemaVersion: 1,
  commitSha: /^[a-f0-9]{40}$/i.test(sha ?? "") ? sha.toLowerCase() : null,
  nextBuildId: (await readFile(path.join(nextDir, "BUILD_ID"), "utf8")).trim(),
  ...await releaseSourceManifest(),
};
await writeFile(path.join(nextDir, "release-manifest.json"), JSON.stringify(manifest, null, 2));
await cp(path.join(nextDir, "release-manifest.json"), path.join(standaloneDir, ".next", "release-manifest.json"));
console.log(`Release artifact: ${JSON.stringify(manifest)}`);

console.log("Standalone assets copied: .next/static and public.");

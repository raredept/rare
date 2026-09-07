import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export function isReleaseSourcePath(relative) {
  const normalized = relative.replaceAll("\\", "/");
  if (/^(?:src\/generated|public\/uploads)(?:\/|$)/.test(normalized)) return false;
  return !/(?:^|\/)(?:\.env(?:\.[^/]*)?|[^/]+\.(?:pem|key|p12|pfx|dump|backup|bak|sqlite3?|db|log))(?:\/|$)/i.test(normalized);
}

export async function releaseSourceManifest(root = process.cwd()) {
  const files = [];
  async function walk(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (!isReleaseSourcePath(name)) continue;
      if (entry.isSymbolicLink()) throw new Error(`Release source must not contain symbolic links: ${name}`);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) files.push(name);
    }
  }
  for (const directory of ["src", "public", "prisma", "scripts"]) await walk(directory);
  files.push("package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "prisma.config.ts", "railway.json");
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    const bytes = await readFile(path.join(root, file));
    // Git normalizes source text between Windows checkouts and Linux builds.
    const canonical = /\.(ts|tsx|js|mjs|json|css|sql|md|toml|txt|svg)$/i.test(file)
      ? Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n")) : bytes;
    hash.update(file).update("\0").update(createHash("sha256").update(canonical).digest("hex")).update("\n");
  }
  return { sourceSha256: hash.digest("hex"), sourceFiles: files.length };
}

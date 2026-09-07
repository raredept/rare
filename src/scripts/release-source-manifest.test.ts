import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const runNode = promisify(execFile);
const manifestScript = pathToFileURL(path.join(process.cwd(), "scripts", "release-source-manifest.mjs")).href;
const prepareScript = path.join(process.cwd(), "scripts", "prepare-standalone.mjs");
const testParent = path.resolve(process.cwd(), "output");
const fixtureRoots: string[] = [];

async function fixture(newline = "\n") {
  await mkdir(testParent, { recursive: true });
  const root = await mkdtemp(path.join(testParent, "release-manifest-test-"));
  fixtureRoots.push(root);
  for (const directory of ["src", "public", "prisma", "scripts", ".next/static"]) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  for (const file of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "prisma.config.ts", "railway.json"]) {
    await writeFile(path.join(root, file), `{${newline}}${newline}`);
  }
  await writeFile(path.join(root, "src", "example.ts"), `export const value = 1;${newline}`);
  await writeFile(path.join(root, "public", "logo.svg"), `<svg />${newline}`);
  await writeFile(path.join(root, ".next", "BUILD_ID"), "test-build-id\n");
  return root;
}

async function manifest(root: string) {
  const { stdout } = await runNode(process.execPath, [
    "--input-type=module", "-e",
    `const { releaseSourceManifest } = await import(${JSON.stringify(manifestScript)}); console.log(JSON.stringify(await releaseSourceManifest(process.argv[1])));`,
    root,
  ], { windowsHide: true });
  return JSON.parse(stdout) as { sourceSha256: string; sourceFiles: number };
}

afterEach(async () => {
  for (const root of fixtureRoots.splice(0)) {
    const relative = path.relative(testParent, root);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe fixture cleanup target.");
    await rm(root, { recursive: true, force: true });
  }
});

describe("release source fingerprint and standalone packaging", () => {
  it("canonicalizes CRLF to LF and changes the fingerprint when application source changes", async () => {
    const lf = await fixture();
    const crlf = await fixture("\r\n");
    const baseline = await manifest(lf);
    expect(await manifest(crlf)).toEqual(baseline);

    await writeFile(path.join(crlf, "src", "example.ts"), "export const value = 2;\r\n");
    expect((await manifest(crlf)).sourceSha256).not.toBe(baseline.sourceSha256);
  });

  it("excludes environment files, private key files, generated code and user uploads from the fingerprint and public artifact", async () => {
    const root = await fixture();
    const baseline = await manifest(root);
    await mkdir(path.join(root, "src", "generated"));
    await mkdir(path.join(root, "public", "uploads"));
    await writeFile(path.join(root, "src", "generated", "client.ts"), "generated\n");
    await writeFile(path.join(root, "scripts", ".env.private"), "TOKEN=synthetic-test-value\n");
    await writeFile(path.join(root, "public", ".env"), "TOKEN=synthetic-test-value\n");
    await writeFile(path.join(root, "public", "private.pem"), "synthetic-test-key\n");
    await writeFile(path.join(root, "public", "uploads", "customer.png"), "synthetic-upload\n");
    expect(await manifest(root)).toEqual(baseline);

    await runNode(process.execPath, [prepareScript], { cwd: root, windowsHide: true });
    const artifact = JSON.parse(await readFile(path.join(root, ".next", "standalone", ".next", "release-manifest.json"), "utf8"));
    expect(artifact).toMatchObject({ ...baseline, nextBuildId: "test-build-id" });
    expect(await readFile(path.join(root, ".next", "standalone", "public", "logo.svg"), "utf8")).toBe("<svg />\n");
    for (const file of [".env", "private.pem", "uploads/customer.png"]) {
      await expect(readFile(path.join(root, ".next", "standalone", "public", file))).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
});

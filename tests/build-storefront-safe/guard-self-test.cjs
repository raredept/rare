/* eslint-disable @typescript-eslint/no-require-imports -- Test executes under the CommonJS preload. */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");

async function main() {
  assert.ok(globalThis.__RARE_SAFE_BUILD_GUARD__, "Safe build preload must be active before the self-test.");
  // A never-created filename, not any real repository credential file.
  const protectedPath = path.join(__dirname, ".env.rare-guard-never-created");
  const deniedRead = (error) => error.code === "ENOENT" && error.rareSafeBuildDenied === true;
  for (const operation of [
    () => fs.readFileSync(protectedPath),
    () => fs.openSync(protectedPath, "r"),
    () => fs.createReadStream(protectedPath),
    () => fs.copyFileSync(protectedPath, path.join(__dirname, "never-created-copy")),
  ]) assert.throws(operation, deniedRead);
  await assert.rejects(fsPromises.readFile(protectedPath), deniedRead);
  await assert.rejects(fsPromises.open(protectedPath, "r"), deniedRead);
  await assert.rejects(new Promise((resolve, reject) => fs.readFile(protectedPath, (error, bytes) => error ? reject(error) : resolve(bytes))), deniedRead);
  const esmFs = await import("node:fs");
  assert.throws(() => esmFs.readFileSync(protectedPath), deniedRead);
  assert.throws(() => fs.readFileSync(path.join(__dirname, ".npmrc")), deniedRead);
  const { loadEnvConfig } = require("@next/env");
  const loaded = loadEnvConfig(path.resolve(__dirname, "../.."));
  assert.equal(loaded.loadedEnvFiles.length, 0, "Next must not load any protected environment file.");
  const socket = new net.Socket();
  assert.throws(() => socket.connect({ host: "127.0.0.1", port: 1 }), { code: "ERR_RARE_SAFE_BUILD_NETWORK_DENIED" });
  socket.destroy();
  await assert.rejects(globalThis.fetch("https://blocked-build.invalid/"), { code: "ERR_RARE_SAFE_BUILD_NETWORK_DENIED" });
  console.log("[safe-build] Guard self-test PASS: protected reads and network calls denied.");
}

main().catch(() => {
  console.error("[safe-build] Guard self-test FAILED; build will not run.");
  process.exitCode = 1;
});

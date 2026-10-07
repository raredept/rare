/* Test-only preload. This guards Node APIs, not native addons or the OS. */
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preloads must be CommonJS. */
"use strict";

const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");

const counts = { environmentReadsDenied: 0, npmConfigReadsDenied: 0, networkCallsDenied: 0 };

function protectedFileKind(input) {
  let filename;
  if (typeof input === "string") filename = input;
  else if (Buffer.isBuffer(input)) filename = input.toString();
  else if (input instanceof URL && input.protocol === "file:") filename = fileURLToPath(input);
  else return null;
  const basename = path.basename(filename).toLowerCase();
  if (basename === ".env" || basename.startsWith(".env.")) return "environment";
  // npm must not load account/registry tokens from project, user or global config.
  if (basename === ".npmrc" || basename === "npmrc" || basename.endsWith(".npmrc")) return "npmConfig";
  return null;
}

function deniedRead(input) {
  const kind = protectedFileKind(input);
  if (!kind) return null;
  counts[kind === "environment" ? "environmentReadsDenied" : "npmConfigReadsDenied"] += 1;
  // @next/env quietly skips ENOENT; never include a path or its contents.
  const error = new Error("RARE safe build protected file read denied.");
  error.code = "ENOENT";
  error.rareSafeBuildDenied = true;
  return error;
}

for (const name of ["readFileSync", "openSync", "createReadStream", "copyFileSync"]) {
  const original = fs[name];
  fs[name] = function guardedSyncRead(input, ...args) {
    const error = deniedRead(input);
    if (error) throw error;
    return original.call(this, input, ...args);
  };
}

for (const name of ["readFile", "open", "copyFile"]) {
  const original = fs[name];
  fs[name] = function guardedCallbackRead(input, ...args) {
    const error = deniedRead(input);
    if (!error) return original.call(this, input, ...args);
    const callback = args.at(-1);
    if (typeof callback !== "function") throw error;
    queueMicrotask(() => callback(error));
  };
  const originalPromise = fsPromises[name];
  fsPromises[name] = async function guardedPromiseRead(input, ...args) {
    const error = deniedRead(input);
    if (error) throw error;
    return originalPromise.call(this, input, ...args);
  };
}

function deniedNetwork() {
  counts.networkCallsDenied += 1;
  const error = new Error("RARE safe build network access denied.");
  error.code = "ERR_RARE_SAFE_BUILD_NETWORK_DENIED";
  throw error;
}

// Deny all outbound Socket connections, including loopback DBs and local IPC.
net.Socket.prototype.connect = deniedNetwork;
globalThis.fetch = async function guardedFetch() {
  deniedNetwork();
};
syncBuiltinESMExports();

Object.defineProperty(globalThis, "__RARE_SAFE_BUILD_GUARD__", {
  value: Object.freeze({ snapshot: () => ({ ...counts }) }),
  writable: false,
  configurable: false,
});

process.once("exit", () => {
  // Child tools such as TypeScript --showConfig reserve stdout for JSON.
  console.error(`[safe-build-guard] ${JSON.stringify({ pid: process.pid, ...counts })}`);
});

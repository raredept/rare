#!/usr/bin/env node

import assert from "node:assert/strict";
import { once } from "node:events";
import { access, cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const standaloneSource = path.join(projectRoot, ".next", "standalone");
const timeoutMs = 30_000;

if (process.platform !== "linux") {
  throw new Error("Este gate precisa ser executado em Linux.");
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function collectOutput(child) {
  let output = "";
  const append = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-12_000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  return () => output;
}

async function runNode(args, options) {
  const child = spawn(process.execPath, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const getOutput = collectOutput(child);
  const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
  const [code, signal] = await once(child, "exit");
  clearTimeout(timer);

  if (code !== 0) {
    throw new Error(`Processo Linux falhou (code=${code}, signal=${signal ?? "none"}).\n${getOutput()}`);
  }

  return getOutput().trim();
}

async function waitForImageOptimizer(url) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
        headers: {
          accept: "image/webp,image/*;q=0.8",
        },
      });
      if (response.ok) return response;
      lastError = new Error(`Image optimizer retornou HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw lastError instanceof Error ? lastError : new Error("Timeout ao iniciar o standalone.");
}

function assertPortIsFree(port) {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once("error", () => reject(new Error(`A porta ${port} ja esta ocupada; o gate nao pode reutilizar outro servidor.`)));
    listener.listen({ host: "127.0.0.1", port, exclusive: true }, () => listener.close(resolve));
  });
}

const isolatedParent = await mkdtemp(path.join(os.tmpdir(), "rare-standalone-linux-"));
const isolatedRoot = path.join(isolatedParent, "app");
let server;

try {
  await access(path.join(standaloneSource, "server.js"));
  await cp(standaloneSource, isolatedRoot, { recursive: true });

  assert(!isWithin(projectRoot, isolatedRoot), "O standalone isolado não pode ficar dentro do projeto.");
  await access(path.join(isolatedRoot, ".next", "static"));
  await access(path.join(isolatedRoot, "public", "brand", "rare-logo.png"));

  const probeOutput = await runNode(
    [
      "-e",
      [
        "const sharp = require('sharp');",
        "const input = sharp({ create: { width: 48, height: 32, channels: 4, background: { r: 12, g: 34, b: 56, alpha: 1 } } }).png();",
        "input.toBuffer().then((png) => sharp(png).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })).then(({ data, info }) => {",
        "  process.stdout.write(JSON.stringify({ resolved: require.resolve('sharp'), sharp: sharp.versions.sharp, vips: sharp.versions.vips, format: info.format, width: info.width, height: info.height, bytes: data.length }));",
        "}).catch((error) => { console.error(error); process.exit(1); });",
      ].join(" "),
    ],
    { cwd: isolatedRoot, env: { PATH: process.env.PATH ?? "" } },
  );
  const sharpProbe = JSON.parse(probeOutput);
  assert(isWithin(path.join(isolatedRoot, "node_modules"), sharpProbe.resolved), "Sharp foi resolvido fora do artefato isolado.");
  assert.equal(sharpProbe.sharp, "0.35.4");
  assert.equal(sharpProbe.format, "webp");
  assert.equal(sharpProbe.width, 48);
  assert.equal(sharpProbe.height, 32);
  assert(sharpProbe.bytes > 0);

  const port = Number(process.env.RARE_LINUX_STANDALONE_PORT ?? 3102);
  assert(Number.isInteger(port) && port > 0 && port < 65_536, "Porta de validação inválida.");
  await assertPortIsFree(port);
  const childEnv = {
    PATH: process.env.PATH ?? "",
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    DATABASE_URL: "postgresql://validation:validation@127.0.0.1:5432/rare_validation",
    ADMIN_SESSION_SECRET: "linux-validation-only-not-a-real-secret-0001",
    APP_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    STORAGE_DRIVER: "r2",
    R2_ACCOUNT_ID: "validation",
    R2_BUCKET: "validation",
    R2_ACCESS_KEY_ID: "validation",
    R2_SECRET_ACCESS_KEY: "validation-only-not-a-real-secret",
    R2_PUBLIC_BASE_URL: "https://media.invalid",
    RATE_LIMIT_DRIVER: "memory",
    EMAIL_DRIVER: "disabled",
    CHECKOUT_ENABLED: "false",
    SHIPPING_ENABLED: "false",
    SHIPPING_PROVIDER: "manual",
  };

  server = spawn(process.execPath, ["server.js"], {
    cwd: isolatedRoot,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const getServerOutput = collectOutput(server);
  const imageUrl = `http://127.0.0.1:${port}/_next/image?url=${encodeURIComponent("/brand/rare-logo.png")}&w=64&q=75`;

  let response;
  try {
    response = await waitForImageOptimizer(imageUrl);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : "Falha no image optimizer."}\n${getServerOutput()}`);
  }

  const optimizedBytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "";
  assert.match(contentType, /^image\/webp(?:;|$)/);
  assert.equal(optimizedBytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(optimizedBytes.subarray(8, 12).toString("ascii"), "WEBP");

  console.log(JSON.stringify({
    os: `${os.type()} ${os.release()}`,
    architecture: process.arch,
    libc: process.report?.getReport().header.glibcVersionRuntime ?? "unknown",
    node: process.version,
    sharp: sharpProbe.sharp,
    libvips: sharpProbe.vips,
    sharpResolvedInsideStandalone: path.relative(isolatedRoot, sharpProbe.resolved),
    sharpTransform: {
      format: sharpProbe.format,
      width: sharpProbe.width,
      height: sharpProbe.height,
      bytes: sharpProbe.bytes,
    },
    assets: {
      static: true,
      publicLogo: true,
    },
    imageOptimizer: {
      status: response.status,
      contentType,
      bytes: optimizedBytes.length,
    },
  }, null, 2));
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000)),
    ]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(isolatedParent, { recursive: true, force: true });
}

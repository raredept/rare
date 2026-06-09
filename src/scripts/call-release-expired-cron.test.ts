import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.join(process.cwd(), "scripts", "call-release-expired-cron.mjs");
const cronSecret = "cron-secret-with-more-than-32-characters";
const servers: ReturnType<typeof createServer>[] = [];

type CronRun = {
  code: number | null;
  stdout: string;
  stderr: string;
};

function safeBaseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    PATH: process.env.PATH,
    Path: process.env.Path,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    COMSPEC: process.env.COMSPEC,
  };
}

function runCron(env: Record<string, string | undefined>): Promise<CronRun> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [scriptPath], {
      env: {
        ...safeBaseEnv(),
        ...env,
      },
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error?.killed) {
        reject(new Error("cron script test timed out"));
        return;
      }

      resolve({
        code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
        stdout: String(stdout),
        stderr: String(stderr),
      });
    });
  });
}

async function withMockServer(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    targetUrl: `http://127.0.0.1:${address.port}/api/cron/release-expired-inventory`,
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe("Railway release-expired cron script", () => {
  it("requires CRON_SECRET", async () => {
    const { targetUrl } = await withMockServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });

    const result = await runCron({ CRON_TARGET_URL: targetUrl });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Configure CRON_SECRET");
  });

  it("requires a target URL source", async () => {
    const result = await runCron({ CRON_SECRET: cronSecret });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Configure CRON_TARGET_URL");
  });

  it("sends the bearer secret and exits successfully for the protected cron endpoint", async () => {
    let authorizationHeader: string | undefined;
    const { targetUrl } = await withMockServer((request, response) => {
      authorizationHeader = request.headers.authorization;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, releasedReservations: 2, timestamp: "2026-06-09T12:00:00.000Z" }));
    });

    const result = await runCron({ CRON_SECRET: cronSecret, CRON_TARGET_URL: targetUrl });

    expect(result.code).toBe(0);
    expect(authorizationHeader).toBe(`Bearer ${cronSecret}`);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      targetOrigin: new URL(targetUrl).origin,
      releasedReservations: 2,
    });
    expect(result.stdout).not.toContain(cronSecret);
    expect(result.stderr).not.toContain(cronSecret);
  });

  it("treats HTTP failures as failed executions without printing the secret", async () => {
    const { targetUrl } = await withMockServer((_request, response) => {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: `Bearer ${cronSecret}` }));
    });

    const result = await runCron({ CRON_SECRET: cronSecret, CRON_TARGET_URL: targetUrl });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Cron endpoint returned 401");
    expect(result.stderr).not.toContain(cronSecret);
  });

  it("resolves RAILWAY_PUBLIC_DOMAIN to the protected cron path", async () => {
    let requestedPath = "";
    const { baseUrl } = await withMockServer((request, response) => {
      requestedPath = request.url ?? "";
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, releasedReservations: 0 }));
    });

    const result = await runCron({ CRON_SECRET: cronSecret, RAILWAY_PUBLIC_DOMAIN: baseUrl });

    expect(result.code).toBe(0);
    expect(requestedPath).toBe("/api/cron/release-expired-inventory");
  });

  it("does not call the production domain from a non-production environment by default", async () => {
    const result = await runCron({
      CRON_SECRET: cronSecret,
      CRON_TARGET_URL: "https://raredept.com.br/api/cron/release-expired-inventory",
      APP_ENV: "local",
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Refusing to call the production cron target");
    expect(result.stderr).not.toContain(cronSecret);
  });
});

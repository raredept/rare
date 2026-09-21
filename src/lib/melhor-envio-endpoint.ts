import { getDeploymentEnvironment } from "@/lib/deployment-environment";

/**
 * MELHOR_ENVIO_BASE_URL overrides where the client sends its Bearer token.
 * It used to accept any http(s) URL, so a typo or a tampered variable would
 * send the token in clear text or to someone else's host. Like the ZeptoMail
 * endpoint, it is now limited to https on the Melhor Envio host that matches
 * MELHOR_ENVIO_ENV. A local http mock is allowed only in development and test.
 */

type EnvLike = Record<string, string | undefined>;

const HOSTS = {
  production: new Set(["www.melhorenvio.com.br", "melhorenvio.com.br"]),
  sandbox: new Set(["sandbox.melhorenvio.com.br"]),
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Null when the override is acceptable, otherwise a fixed reason that never echoes the value. */
export function getMelhorEnvioBaseUrlIssue(value: string, env: EnvLike = process.env): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "MELHOR_ENVIO_BASE_URL must be an absolute URL.";
  }

  if (url.username || url.password) return "MELHOR_ENVIO_BASE_URL must not carry credentials.";

  if (LOCAL_HOSTS.has(url.hostname)) {
    return getDeploymentEnvironment(env) === "development" && (url.protocol === "http:" || url.protocol === "https:")
      ? null
      : "MELHOR_ENVIO_BASE_URL may point to localhost only in development.";
  }

  if (url.protocol !== "https:") return "MELHOR_ENVIO_BASE_URL must use https.";

  const mode = env.MELHOR_ENVIO_ENV?.trim().toLowerCase() === "sandbox" ? "sandbox" : "production";
  if (!HOSTS[mode].has(url.hostname)) {
    return `MELHOR_ENVIO_BASE_URL must be the Melhor Envio ${mode} host (MELHOR_ENVIO_ENV=${mode}).`;
  }
  return null;
}

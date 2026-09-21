import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isRestrictedAppEnv } from "@/lib/deployment-environment";

export function isRestrictedEnvironment(env: Record<string, string | undefined> = process.env) {
  return isRestrictedAppEnv(env);
}

function matches(actual: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

// The outer gate restricts the entire test storefront. Admin/customer authorization
// and Stripe signature verification remain responsible for their own resources.
export function checkStagingAccess(request: NextRequest) {
  if (!isRestrictedEnvironment()) return null;
  const path = request.nextUrl.pathname;
  if (path === "/api/stripe/webhook" && request.method === "POST") return null;
  if (["/api/health", "/robots.txt"].includes(path) && ["GET", "HEAD"].includes(request.method)) return null;

  const username = process.env.STAGING_ACCESS_USERNAME;
  const password = process.env.STAGING_ACCESS_PASSWORD;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!username || !password || password.length < 32) {
    return new NextResponse("Ambiente de homologação indisponível.", { status: 503, headers });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Basic ")) {
    const supplied = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    if (matches(supplied, `${username}:${password}`)) return null;
  }
  return new NextResponse("Acesso restrito à homologação.", {
    status: 401,
    headers: { ...headers, "WWW-Authenticate": 'Basic realm="RARE homologacao", charset="UTF-8"' },
  });
}

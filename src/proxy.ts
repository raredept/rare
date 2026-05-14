import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "@/lib/auth-constants";
import { getOptionalAdminSessionSecret } from "@/lib/env";

function getSecret() {
  const secret = getOptionalAdminSessionSecret();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidAdminSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const secret = getSecret();
  if (!token || !secret) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "ADMIN" && typeof payload.sub === "string";
  } catch {
    return false;
  }
}

async function hasValidCustomerSession(request: NextRequest) {
  const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  const secret = getSecret();
  if (!token || !secret) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role === "CUSTOMER" && typeof payload.sub === "string";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");
  const isCustomerPage = pathname.startsWith("/minha-conta");

  if (!isAdminPage && !isAdminApi && !isCustomerPage) {
    return NextResponse.next();
  }

  if (isAdminPage || isAdminApi) {
    if (await hasValidAdminSession(request)) {
      return NextResponse.next();
    }

    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isCustomerPage) {
    if (await hasValidCustomerSession(request)) {
      return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/entrar";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/minha-conta/:path*"],
};

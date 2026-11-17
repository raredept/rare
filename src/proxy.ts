import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_PUBLIC_PATHS, ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "@/lib/auth-constants";
import { isAdminMfaRequired } from "@/lib/admin-mfa-config";
import { isAdminRole } from "@/lib/admin-permissions";
import { getOptionalAdminSessionSecret } from "@/lib/env";
import { checkStagingAccess, isRestrictedEnvironment } from "@/lib/staging-access";
import packageJson from "../package.json";
import {
  buildServerActionRequestRecord,
  isServerActionRequest,
  type ServerActionAuthState,
} from "@/lib/server-action-observability";

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
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    // Coarse edge check only; getCurrentAdmin() re-validates against the database. It still
    // refuses a session without a verified second factor, so a pre-MFA or password-only token
    // never even reaches an Admin route when MFA is required.
    return (
      (payload.typ === undefined || payload.typ === "admin") &&
      isAdminRole(payload.role) &&
      typeof payload.sub === "string" &&
      typeof payload.credentialVersion === "string" &&
      (!isAdminMfaRequired() || payload.mfa === true)
    );
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

type PublicNotFoundCopy = {
  eyebrow: string;
  title: string;
  description: string;
};

const publicNotFoundCopy = {
  product: {
    eyebrow: "Produto indisponível",
    title: "Produto não encontrado",
    description: "Essa peça não está disponível no catálogo da RARE. Ela pode ter saído de estoque ou o link pode estar incorreto.",
  },
  category: {
    eyebrow: "Categoria indisponível",
    title: "Categoria não encontrada",
    description: "Essa seleção não existe no catálogo da RARE. Explore o catálogo completo ou veja os destaques ativos da loja.",
  },
} satisfies Record<"product" | "category", PublicNotFoundCopy>;

function isDocumentRequest(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("rsc") === "1" || request.nextUrl.searchParams.has("_rsc")) return false;

  const accept = request.headers.get("accept") ?? "";
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

function getSingleRouteSlug(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return null;

  const slug = pathname.slice(prefix.length);
  if (!slug || slug.includes("/")) return null;

  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function storeNotFoundResponse(copy: PublicNotFoundCopy) {
  // A real 404 decided here (before any streaming), dressed like the store (UIUX-404-001): black
  // header with the logo, search, the main collections and a footer. Static on purpose: no data,
  // no script, nothing the request could inject (the copy is fixed above).
  return new NextResponse(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${copy.title} | RARE</title>
    <style>
      :root { color-scheme: light; background: #fafafa; color: #0a0a0a; font-family: "Helvetica Neue", Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; background: #fafafa; color: #0a0a0a; }
      header { background: #000000; color: #ffffff; }
      .wrap { width: min(100%, 1440px); margin: 0 auto; padding-left: 1rem; padding-right: 1rem; }
      nav { min-height: 72px; display: flex; align-items: center; gap: 1.5rem; }
      .brand { display: inline-flex; align-items: center; min-height: 44px; color: #ffffff; text-decoration: none; }
      .brand img { height: 40px; width: auto; display: block; }
      .links { display: none; gap: 0.5rem; margin-left: auto; }
      .links a { min-height: 44px; display: inline-flex; align-items: center; padding: 0 1rem; border: 1px solid rgb(255 255 255 / 0.2); border-radius: 999px; color: #ffffff; text-decoration: none; font-size: 0.875rem; font-weight: 700; }
      main { flex: 1; display: flex; align-items: center; padding-top: 3.5rem; padding-bottom: 3.5rem; }
      .content { max-width: 42rem; }
      .eyebrow { margin: 0; color: #525252; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; }
      h1 { margin: 1rem 0 0; font-size: clamp(2.5rem, 8vw, 4rem); font-weight: 900; line-height: 0.95; letter-spacing: -0.02em; }
      .description { margin: 1.25rem 0 0; max-width: 36rem; color: #525252; font-size: 1rem; font-weight: 600; line-height: 1.6; }
      form { display: flex; gap: 0.5rem; max-width: 36rem; margin-top: 2rem; }
      input { flex: 1; min-width: 0; height: 48px; border: 1px solid #d4d4d4; border-radius: 0.375rem; padding: 0 1rem; font: inherit; font-size: 16px; font-weight: 600; background: #ffffff; }
      button { height: 48px; border: 0; border-radius: 0.375rem; padding: 0 1rem; background: #000000; color: #ffffff; font: inherit; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
      .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
      .button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 1.25rem; text-decoration: none; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; }
      .button-primary { background: #000000; color: #ffffff; border: 1px solid #000000; }
      .button-secondary { background: transparent; color: #262626; border: 1px solid #d4d4d4; }
      footer { background: #000000; color: #d4d4d4; padding: 2rem 0; font-size: 0.875rem; font-weight: 600; }
      footer a { color: #ffffff; text-decoration: none; display: inline-flex; min-height: 44px; align-items: center; margin-right: 1.25rem; }
      :focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
      @media (min-width: 640px) { .wrap { padding-left: 1.5rem; padding-right: 1.5rem; } }
      @media (min-width: 1024px) { .wrap { padding-left: 2rem; padding-right: 2rem; } .links { display: flex; } }
    </style>
  </head>
  <body>
    <header>
      <nav class="wrap" aria-label="Topo da loja">
        <a class="brand" href="/" aria-label="RARE"><img src="/brand/rare-logo.png" alt="RARE" width="118" height="40" /></a>
        <div class="links">
          <a href="/categoria/destaques">Destaques</a>
          <a href="/categoria/tudo">Tudo</a>
        </div>
      </nav>
    </header>
    <main class="wrap">
      <section class="content" aria-labelledby="not-found-title">
        <p class="eyebrow">${copy.eyebrow}</p>
        <h1 id="not-found-title">${copy.title}</h1>
        <p class="description">${copy.description}</p>
        <form action="/" method="get" role="search">
          <label for="not-found-search" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Buscar na loja</label>
          <input id="not-found-search" name="q" type="search" required placeholder="Buscar peças, marcas ou categorias" autocomplete="off" />
          <button type="submit">Buscar</button>
        </form>
        <div class="actions">
          <a class="button button-primary" href="/categoria/tudo">Ver catálogo</a>
          <a class="button button-secondary" href="/categoria/destaques">Ver destaques</a>
        </div>
      </section>
    </main>
    <footer>
      <div class="wrap">
        <a href="/suporte">Suporte</a><a href="/trocas-e-devolucoes">Trocas e devoluções</a><a href="/politica-de-envio">Política de envio</a><a href="/minha-conta/pedidos">Meus pedidos</a>
        <p style="margin:1rem 0 0">© RARE</p>
      </div>
    </footer>
  </body>
</html>`,
    {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "noindex",
      },
    },
  );
}

async function getPublicCatalogNotFoundResponse(request: NextRequest) {
  if (!isDocumentRequest(request)) return null;

  const { pathname } = request.nextUrl;
  const productSlug = getSingleRouteSlug(pathname, "/produto/");
  if (productSlug) {
    const { isProductPageSlugAvailable } = await import("@/lib/storefront");
    if (!(await isProductPageSlugAvailable(productSlug))) {
      return storeNotFoundResponse(publicNotFoundCopy.product);
    }
    return null;
  }

  const categorySlug = getSingleRouteSlug(pathname, "/categoria/");
  if (categorySlug) {
    const { isCategoryPageSlugAvailable } = await import("@/lib/storefront");
    if (!(await isCategoryPageSlugAvailable(categorySlug))) {
      return storeNotFoundResponse(publicNotFoundCopy.category);
    }
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const stagingResponse = checkStagingAccess(request);
  if (stagingResponse) return stagingResponse;
  const { pathname } = request.nextUrl;
  const isAdminPage = (pathname === "/admin" || pathname.startsWith("/admin/")) && !ADMIN_PUBLIC_PATHS.includes(pathname);
  const isAdminApi = pathname.startsWith("/api/admin");
  const isCustomerPage = pathname.startsWith("/minha-conta");
  const actionRequest = isServerActionRequest(request.method, request.headers);
  const requestId = actionRequest ? crypto.randomUUID() : undefined;

  function continueRequest() {
    if (!requestId) {
      const response = NextResponse.next();
      if (isRestrictedEnvironment()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
    const headers = new Headers(request.headers);
    headers.set("x-rare-request-id", requestId);
    const response = NextResponse.next({ request: { headers } });
    if (isRestrictedEnvironment()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const publicCatalogNotFoundResponse = await getPublicCatalogNotFoundResponse(request);
  if (publicCatalogNotFoundResponse) {
    return publicCatalogNotFoundResponse;
  }

  if (!isAdminPage && !isAdminApi && !isCustomerPage) {
    if (actionRequest) {
      console.info("[RARE server action] request", buildServerActionRequestRecord({
        route: pathname,
        method: request.method,
        requestId: requestId!,
        authState: "anonymous",
        appVersion: packageJson.version,
      }));
    }
    return continueRequest();
  }

  if (isAdminPage || isAdminApi) {
    const validAdminSession = await hasValidAdminSession(request);
    if (actionRequest) {
      const authState: ServerActionAuthState = validAdminSession ? "admin" : "anonymous";
      console.info("[RARE server action] request", buildServerActionRequestRecord({
        route: pathname,
        method: request.method,
        requestId: requestId!,
        authState,
        appVersion: packageJson.version,
      }));
    }
    if (validAdminSession) {
      return continueRequest();
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
    const validCustomerSession = await hasValidCustomerSession(request);
    if (actionRequest) {
      const authState: ServerActionAuthState = validCustomerSession ? "customer" : "anonymous";
      console.info("[RARE server action] request", buildServerActionRequestRecord({
        route: pathname,
        method: request.method,
        requestId: requestId!,
        authState,
        appVersion: packageJson.version,
      }));
    }
    if (validCustomerSession) {
      return continueRequest();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/entrar";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return continueRequest();
}

export const config = {
  matcher: [
    "/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/minha-conta/:path*",
    "/entrar",
    "/cadastro",
    "/produto/:path*",
    "/categoria/:path*",
  ],
};

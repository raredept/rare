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
  return new NextResponse(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${copy.title} | RARE</title>
    <style>
      :root { color-scheme: light; background: #fafafa; color: #0a0a0a; font-family: Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #fafafa; color: #0a0a0a; }
      header { border-bottom: 1px solid #e5e5e5; background: #ffffff; }
      nav, main { width: min(100%, 1440px); margin: 0 auto; padding-left: 1rem; padding-right: 1rem; }
      nav { min-height: 72px; display: flex; align-items: center; justify-content: space-between; }
      .brand { color: #0a0a0a; text-decoration: none; font-size: 1.5rem; font-weight: 900; letter-spacing: 0.24em; }
      main { min-height: 58vh; display: flex; align-items: center; padding-top: 3.5rem; padding-bottom: 3.5rem; }
      .content { max-width: 42rem; }
      .eyebrow { margin: 0; color: #737373; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; }
      h1 { margin: 1rem 0 0; font-size: clamp(2.5rem, 8vw, 4rem); line-height: 0.95; letter-spacing: -0.02em; }
      .description { margin: 1.25rem 0 0; max-width: 36rem; color: #737373; font-size: 1rem; font-weight: 600; line-height: 1.6; }
      .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }
      .button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 0 1.25rem; text-decoration: none; font-size: 0.75rem; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; }
      .button-primary { background: #000000; color: #ffffff; border: 1px solid #000000; }
      .button-secondary { background: transparent; color: #262626; border: 1px solid #d4d4d4; }
      @media (min-width: 640px) { nav, main { padding-left: 1.5rem; padding-right: 1.5rem; } }
      @media (min-width: 1024px) { nav, main { padding-left: 2rem; padding-right: 2rem; } }
    </style>
  </head>
  <body>
    <header>
      <nav aria-label="Topo da loja">
        <a class="brand" href="/">RARE</a>
      </nav>
    </header>
    <main>
      <section class="content" aria-labelledby="not-found-title">
        <p class="eyebrow">${copy.eyebrow}</p>
        <h1 id="not-found-title">${copy.title}</h1>
        <p class="description">${copy.description}</p>
        <div class="actions">
          <a class="button button-primary" href="/categoria/tudo">Ver catálogo</a>
          <a class="button button-secondary" href="/categoria/destaques">Ver destaques</a>
        </div>
      </section>
    </main>
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
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");
  const isCustomerPage = pathname.startsWith("/minha-conta");

  const publicCatalogNotFoundResponse = await getPublicCatalogNotFoundResponse(request);
  if (publicCatalogNotFoundResponse) {
    return publicCatalogNotFoundResponse;
  }

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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/minha-conta/:path*", "/produto/:path*", "/categoria/:path*"],
};

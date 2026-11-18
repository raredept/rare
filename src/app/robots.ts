import type { MetadataRoute } from "next";
import { isPublicIndexingEnabled } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CANONICAL_SITE_URL = "https://raredept.com.br";

// robots.txt rules are PREFIX matches against path + query: a bare "/conta" would also block the public
// "/contato" page (RARE-SEO-GOOGLE-01). Routes that share a prefix with a public page are split into:
// "$" (exact path, supported by Google), "?" (the same path with any query string — "$" alone would leave
// "/conta?tab=perfil" open) and "/" (children). Never go back to the bare prefix.
const PRIVATE_ROUTES = [
  "/admin",
  "/api",
  "/checkout",
  "/finalizar-compra",
  "/cart",
  "/conta$",
  "/conta?",
  "/conta/",
  "/minha-conta",
  "/entrar",
  "/cadastro",
  "/pedido",
  "/pedidos",
  "/_next/data",
];

type EnvLike = Record<string, string | undefined>;

export function buildRobots(env: EnvLike = process.env): MetadataRoute.Robots {
  if (!isPublicIndexingEnabled(env)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_ROUTES,
    },
    // No "host" line: Google ignores it (only user-agent/allow/disallow/sitemap are read).
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}

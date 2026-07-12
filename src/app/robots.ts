import type { MetadataRoute } from "next";
import { isPublicIndexingEnabled } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CANONICAL_SITE_URL = "https://raredept.com.br";

const PRIVATE_ROUTES = [
  "/admin",
  "/api",
  "/checkout",
  "/finalizar-compra",
  "/cart",
  "/conta",
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
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
    host: CANONICAL_SITE_URL,
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobots();
}

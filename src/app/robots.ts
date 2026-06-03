import type { MetadataRoute } from "next";

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

export default function robots(): MetadataRoute.Robots {
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

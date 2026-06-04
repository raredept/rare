import { describe, expect, it } from "vitest";
import { absoluteUrl } from "@/lib/seo";

const pages = [
  { path: "/sobre", load: () => import("@/app/(store)/sobre/page"), title: "Sobre a RARE" },
  { path: "/contato", load: () => import("@/app/(store)/contato/page"), title: "Contato" },
  { path: "/politica-de-envio", load: () => import("@/app/(store)/politica-de-envio/page"), title: "Política de envio" },
  { path: "/privacidade-e-termos", load: () => import("@/app/(store)/privacidade-e-termos/page"), title: "Privacidade e termos" },
  { path: "/trocas-e-devolucoes", load: () => import("@/app/(store)/trocas-e-devolucoes/page"), title: "Trocas e Devoluções" },
] as const;

describe("store institutional page metadata", () => {
  it.each(pages)("exports canonical Open Graph and Twitter metadata for $path", async ({ load, path, title }) => {
    const { metadata } = await load();
    const canonical = absoluteUrl(path);

    expect(metadata.title).toBe(title);
    expect(metadata.alternates).toEqual({ canonical });
    expect(metadata.openGraph).toMatchObject({
      title: `${title} | RARE`,
      url: canonical,
      siteName: "RARE",
      locale: "pt_BR",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: `${title} | RARE`,
    });
  });
});

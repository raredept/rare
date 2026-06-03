import type { Metadata } from "next";
import { StoreNotFoundPage } from "@/components/store/not-found-page";

export const metadata: Metadata = {
  title: "Categoria não encontrada",
  robots: {
    index: false,
  },
};

export default function CategoryNotFound() {
  return (
    <StoreNotFoundPage
      eyebrow="Categoria indisponível"
      title="Categoria não encontrada"
      description="Essa seleção não existe no catálogo da RARE. Explore o catálogo completo ou veja os destaques ativos da loja."
      primaryAction={{ href: "/categoria/tudo", label: "Ver catálogo" }}
      secondaryAction={{ href: "/categoria/destaques", label: "Ver destaques" }}
    />
  );
}

import type { Metadata } from "next";
import { StoreNotFoundPage } from "@/components/store/not-found-page";

export const metadata: Metadata = {
  title: "Produto não encontrado",
  robots: {
    index: false,
  },
};

export default function ProductNotFound() {
  return (
    <StoreNotFoundPage
      eyebrow="Produto indisponível"
      title="Produto não encontrado"
      description="Essa peça não está disponível no catálogo da RARE. Ela pode ter saído de estoque ou o link pode estar incorreto."
      primaryAction={{ href: "/categoria/tudo", label: "Ver catálogo" }}
      secondaryAction={{ href: "/categoria/destaques", label: "Ver destaques" }}
    />
  );
}

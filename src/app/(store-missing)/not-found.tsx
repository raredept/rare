import type { Metadata } from "next";
import { StoreNotFoundPage } from "@/components/store/not-found-page";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false },
};

// UIUX-404-001: rendered inside the store frame (header, search, footer) for unmatched URLs, reached
// through (store-missing)/[...missing]/page.tsx.
export default function StoreNotFound() {
  return (
    <StoreNotFoundPage
      eyebrow="Página indisponível"
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi removido. Busque a peça que procura ou explore o catálogo ativo da RARE."
      primaryAction={{ href: "/categoria/tudo", label: "Ver catálogo" }}
      secondaryAction={{ href: "/", label: "Ir para a Home" }}
    />
  );
}

import type { Metadata } from "next";
import { StoreNotFoundPage } from "@/components/store/not-found-page";

export const metadata: Metadata = {
  title: "Coleção indisponível",
  robots: { index: false },
};

// A collection that is not public right now (scheduled, paused, ended, without products or unknown).
export default function CollectionNotFound() {
  return (
    <StoreNotFoundPage
      eyebrow="Coleção indisponível"
      title="Coleção não encontrada"
      description="Esta coleção não está disponível agora. Ela pode ter terminado ou ainda não ter começado. Explore o catálogo ativo da RARE."
      primaryAction={{ href: "/categoria/tudo", label: "Ver catálogo" }}
      secondaryAction={{ href: "/", label: "Ir para a Home" }}
    />
  );
}

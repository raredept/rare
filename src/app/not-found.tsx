import { StoreNotFoundPage } from "@/components/store/not-found-page";

export default function GlobalNotFound() {
  return (
    <StoreNotFoundPage
      eyebrow="Página indisponível"
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi removido. Volte para a Home ou explore o catálogo ativo da RARE."
      primaryAction={{ href: "/", label: "Ir para a Home" }}
      secondaryAction={{ href: "/categoria/tudo", label: "Ver catálogo" }}
    />
  );
}

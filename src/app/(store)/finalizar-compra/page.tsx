import { StoreCheckoutPage } from "@/components/store/checkout-page";
import { buildNoIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildNoIndexMetadata({
  title: "Finalizar compra | RARE",
  description: "Finalize sua compra com dados de contato, entrega e resumo do pedido na RARE.",
  path: "/finalizar-compra",
});

type FinalizarCompraPageProps = {
  searchParams: Promise<{ address?: string; checkout?: string }>;
};

export default async function FinalizarCompraPage({ searchParams }: FinalizarCompraPageProps) {
  return <StoreCheckoutPage searchParams={searchParams} />;
}

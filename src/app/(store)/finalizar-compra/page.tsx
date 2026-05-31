import type { Metadata } from "next";
import { StoreCheckoutPage } from "@/components/store/checkout-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Finalize sua compra com dados de contato, entrega e resumo do pedido na RARE.",
  alternates: {
    canonical: "/finalizar-compra",
  },
};

type FinalizarCompraPageProps = {
  searchParams: Promise<{ address?: string; checkout?: string }>;
};

export default async function FinalizarCompraPage({ searchParams }: FinalizarCompraPageProps) {
  return <StoreCheckoutPage searchParams={searchParams} />;
}

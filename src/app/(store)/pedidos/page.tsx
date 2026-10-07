import Link from "next/link";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Pedidos | RARE",
  description: "Acompanhe pedidos vinculados à sua conta RARE.",
  path: "/pedidos",
});

export default function CustomerOrdersPage() {
  return (
    <div className="store-shell max-w-3xl py-16 sm:py-20">
      <h1 className="text-4xl font-medium tracking-tight text-neutral-950">Pedidos</h1>
      <p className="mt-6 text-base leading-8 text-neutral-600">Acompanhe pedidos vinculados à sua conta. Para suporte, use um dos canais oficiais da RARE.</p>
      <Link
        href="/"
        className="store-button-primary mt-8 w-full sm:w-auto"
      >
        Explorar catálogo
      </Link>
    </div>
  );
}

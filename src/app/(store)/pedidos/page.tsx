import Link from "next/link";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata = buildNoIndexMetadata({
  title: "Pedidos | RARE",
  description: "Acompanhe pedidos vinculados à sua conta RARE.",
  path: "/pedidos",
});

export default function CustomerOrdersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
      <h1 className="text-3xl font-black text-neutral-950">Pedidos</h1>
      <p className="mt-4 text-neutral-600">Acompanhe pedidos vinculados à sua conta. Para suporte, use um dos canais oficiais da RARE.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
      >
        Explorar catálogo
      </Link>
    </div>
  );
}

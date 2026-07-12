import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { AtSign, MessageCircle } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "Contato",
  description: "Canais de atendimento da RARE para dúvidas sobre produtos, pedidos, trocas e pós-compra.",
  path: "/contato",
});

export default async function ContactPage() {
  const { getStoreSettings } = await import("@/lib/settings");
  const settings = await getStoreSettings();
  const whatsappDigits = settings.whatsappNumber?.replace(/\D/g, "");
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Atendimento</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">Contato RARE</h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-neutral-600 sm:text-lg">
          Use o atendimento para tirar dúvidas sobre produto, tamanho, pedido, entrega, troca ou devolução.
        </p>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <article className="rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Canais oficiais</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="https://www.instagram.com/raredept/" target="_blank" rel="noopener noreferrer" className="store-button-secondary gap-2"><AtSign className="h-4 w-4" /> Instagram</a>
            {whatsappDigits ? <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="store-button-primary gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp</a> : null}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-neutral-500">
            Informe nome, pedido se houver, produto e uma descrição objetiva da solicitação.
          </p>
        </article>
        <article className="rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Pedidos</p>
          <h2 className="mt-4 text-xl font-black text-neutral-950">Acompanhe pela sua conta</h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-neutral-500">
            Pedidos vinculados à sua conta ficam disponíveis para consulta na área do cliente.
          </p>
          <Link href="/minha-conta/pedidos" className="mt-5 inline-flex text-sm font-black text-neutral-950 underline underline-offset-4">
            Ver meus pedidos
          </Link>
        </article>
      </section>
    </div>
  );
}

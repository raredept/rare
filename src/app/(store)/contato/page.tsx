import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { AtSign, MessageCircle } from "lucide-react";
import { getInstagramUrl } from "@/lib/store-social";

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
    <div className="store-shell max-w-5xl py-14 sm:py-16 lg:py-20">
      <section className="max-w-3xl">
        <p className="store-section-label">Atendimento</p>
        <h1 className="mt-5 text-4xl font-medium tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">Contato RARE</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-600 sm:text-lg">
          Use o atendimento para tirar dúvidas sobre produto, tamanho, pedido, entrega, troca ou devolução.
        </p>
      </section>

      <section className="mt-12 grid gap-10 border-t border-neutral-200 pt-8 sm:grid-cols-2 sm:gap-12 sm:pt-10">
        <article className="min-w-0 border-b border-neutral-200 pb-8">
          <p className="store-section-label">Canais oficiais</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={getInstagramUrl(settings.instagramUrl)} target="_blank" rel="noopener noreferrer" className="store-button-secondary gap-2"><AtSign className="h-4 w-4" aria-hidden="true" /> Instagram</a>
            {whatsappDigits ? <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="store-button-primary gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp</a> : null}
          </div>
          <p className="mt-5 text-base leading-7 text-neutral-600">
            Informe nome, pedido se houver, produto e uma descrição objetiva da solicitação.
          </p>
        </article>
        <article className="min-w-0 border-b border-neutral-200 pb-8">
          <p className="store-section-label">Pedidos</p>
          <h2 className="mt-4 text-2xl font-medium tracking-tight text-neutral-950">Acompanhe pela sua conta</h2>
          <p className="mt-4 text-base leading-7 text-neutral-600">
            Pedidos vinculados à sua conta ficam disponíveis para consulta na área do cliente.
          </p>
          <Link href="/minha-conta/pedidos" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-neutral-950 underline underline-offset-4">
            Ver meus pedidos
          </Link>
        </article>
      </section>
    </div>
  );
}

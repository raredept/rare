import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Política de envio",
  description: "Como a RARE trata frete, prazo e endereço de entrega no checkout.",
  path: "/politica-de-envio",
});

const shippingItems = [
  {
    title: "Frete e prazo",
    text: "Frete e prazo são calculados no checkout com base no CEP e no endereço de entrega informados.",
  },
  {
    title: "Endereço",
    text: "Confira CEP, rua, número, bairro, cidade e estado antes de finalizar o pedido.",
  },
  {
    title: "Acompanhamento",
    text: "As atualizações do pedido ficam vinculadas ao atendimento e à área do cliente quando a compra usa conta cadastrada.",
  },
];

export default function ShippingPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Entrega</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">Política de envio</h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-neutral-600 sm:text-lg">
          A RARE trabalha com cálculo de frete no checkout e validação dos dados de entrega antes da finalização.
        </p>
      </section>

      <section className="mt-12 border-y border-neutral-200">
        {shippingItems.map((item) => (
          <article key={item.title} className="border-b border-neutral-200 py-8 last:border-b-0">
            <h2 className="text-2xl font-black tracking-tight text-neutral-950">{item.title}</h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-neutral-600">{item.text}</p>
          </article>
        ))}
      </section>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/categoria/tudo" className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 text-xs font-black uppercase tracking-[0.16em] text-white">
          Ver catálogo
        </Link>
        <Link
          href="/trocas-e-devolucoes"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-300 px-6 text-xs font-black uppercase tracking-[0.16em] text-neutral-950"
        >
          Trocas e devoluções
        </Link>
      </div>
    </div>
  );
}

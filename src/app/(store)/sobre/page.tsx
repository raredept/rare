import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Curadoria RARE",
  description: "Conheça a proposta da curadoria RARE para streetwear, importados e drops selecionados.",
  alternates: {
    canonical: "/sobre",
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Curadoria RARE</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">
          Streetwear, importados e drops selecionados
        </h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-neutral-600 sm:text-lg">
          A RARE organiza uma seleção direta de peças para quem busca produtos com presença, estoque controlado e compra
          objetiva. A home apresenta os caminhos de compra; o catálogo concentra a curadoria completa.
        </p>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {["Curadoria", "Estoque controlado", "Atendimento direto"].map((item) => (
          <article key={item} className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-lg font-black text-neutral-950">{item}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-neutral-500">
              Processo simples, visual limpo e foco em peças que façam sentido para o drop atual.
            </p>
          </article>
        ))}
      </section>

      <Link
        href="/categoria/tudo"
        className="mt-12 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 text-xs font-black uppercase tracking-[0.16em] text-white"
      >
        Ver catálogo completo
      </Link>
    </div>
  );
}

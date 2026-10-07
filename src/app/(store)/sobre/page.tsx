import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Sobre a RARE",
  description: "Streetwear importado, drops limitados e peças escolhidas para quem busca sair do comum.",
  path: "/sobre",
});

export default function AboutPage() {
  return (
    <div className="store-shell max-w-5xl py-14 sm:py-16 lg:py-20">
      <section className="max-w-3xl">
        <p className="store-section-label">Sobre a RARE</p>
        <h1 className="mt-5 text-4xl font-medium tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">
          Streetwear importado para sair do básico
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-600 sm:text-lg">
          A RARE reúne peças importadas, drops limitados e escolhas de presença para quem não quer se vestir igual a todo mundo.
        </p>
      </section>

      <section className="mt-12 grid gap-8 border-y border-neutral-200 py-8 sm:grid-cols-3 sm:py-10">
        {[
          { title: "Peças escolhidas a dedo", text: "Streetwear importado com foco em presença, uso real e combinações fortes." },
          { title: "Estoque limitado", text: "Quando uma peça sai, pode não voltar tão cedo." },
          { title: "Atendimento direto", text: "Dúvidas sobre tamanho, produto ou pedido são tratadas sem enrolação." },
        ].map((item) => (
          <article key={item.title} className="min-w-0">
            <h2 className="text-xl font-medium tracking-tight text-neutral-950">{item.title}</h2>
            <p className="mt-4 text-base leading-7 text-neutral-600">
              {item.text}
            </p>
          </article>
        ))}
      </section>

      <Link
        href="/categoria/tudo"
        className="store-button-primary mt-10 w-full sm:w-auto"
      >
        Ver catálogo completo
      </Link>
    </div>
  );
}

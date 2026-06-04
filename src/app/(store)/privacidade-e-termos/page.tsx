import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Privacidade e termos",
  description: "Informações básicas sobre dados, pedidos, pagamento e uso da loja RARE.",
  path: "/privacidade-e-termos",
});

const terms = [
  {
    title: "Dados de compra",
    text: "Dados informados na loja são usados para processar pedidos, entrega, atendimento e comunicações relacionadas à compra.",
  },
  {
    title: "Pagamento",
    text: "O pagamento é conduzido pelo provedor oficial de checkout. A RARE não solicita dados completos de cartão por atendimento direto.",
  },
  {
    title: "Conta e pedidos",
    text: "A área do cliente existe para acompanhar dados cadastrados, endereços e histórico de pedidos vinculados à conta.",
  },
  {
    title: "Atendimento",
    text: "Solicitações de suporte devem ser enviadas com informações objetivas para facilitar conferência e resposta.",
  },
];

export default function PrivacyAndTermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">RARE</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">
          Privacidade e termos
        </h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-neutral-600 sm:text-lg">
          Informações simples sobre uso da loja, dados de compra, pagamento e atendimento.
        </p>
      </section>

      <section className="mt-12 border-y border-neutral-200">
        {terms.map((item) => (
          <article key={item.title} className="border-b border-neutral-200 py-8 last:border-b-0">
            <h2 className="text-2xl font-black tracking-tight text-neutral-950">{item.title}</h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-neutral-600">{item.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

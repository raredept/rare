export const metadata = {
  title: "Trocas e Devoluções",
  description: "Política de trocas e devoluções da RARE.",
};

const policyParagraphs = [
  "A Rare aceita devoluções em até 7 dias corridos após o recebimento do produto, conforme o Código de Defesa do Consumidor.",
  "Para aprovação da troca ou devolução, o produto deve estar sem sinais de uso, com etiquetas e embalagem original.",
  "Trocas por tamanho poderão ser realizadas mediante disponibilidade em estoque.",
  "Produtos com defeito poderão ser trocados ou reembolsados após análise.",
  "Para solicitar uma troca ou devolução, entre em contato pelo WhatsApp ou e-mail de suporte.",
];

const policyItems = [
  {
    title: "Prazo",
    text: policyParagraphs[0],
  },
  {
    title: "Condição do produto",
    text: policyParagraphs[1],
  },
  {
    title: "Troca por tamanho",
    text: policyParagraphs[2],
  },
  {
    title: "Produto com defeito",
    text: policyParagraphs[3],
  },
  {
    title: "Solicitação",
    text: policyParagraphs[4],
  },
];

export default function ExchangesAndReturnsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl pb-10 sm:pb-12">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Política RARE</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">
          Trocas e devoluções
        </h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-neutral-600 sm:text-lg">
          Regras claras para análise de devolução, troca por tamanho e atendimento em caso de defeito.
        </p>
      </section>

      <section className="border-y border-neutral-200">
        {policyItems.map((item, index) => (
          <article
            key={item.title}
            className="grid gap-4 border-b border-neutral-200 py-8 last:border-b-0 sm:grid-cols-[5rem_1fr] sm:gap-8 sm:py-10"
          >
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-400 sm:pt-1">
              {String(index + 1).padStart(2, "0")}
            </p>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-neutral-950">{item.title}</h2>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-neutral-600">{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-14 rounded-lg bg-black px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-white/45">Atendimento</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
          Precisa solicitar uma troca ou devolução?
        </h2>
        <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/65">
          Antes de enviar o produto, fale com o atendimento da RARE pelo WhatsApp ou pelo e-mail de suporte. Assim a
          equipe registra a solicitação, orienta a análise e confirma os próximos passos.
        </p>
      </section>
    </div>
  );
}

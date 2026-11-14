import { CookiePreferencesButton } from "@/components/store/cookie-consent";
import { COOKIE_CATALOG, COOKIE_CONSENT_MAX_AGE_DAYS } from "@/lib/cookie-consent";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_ANALYTICS_RETENTION_DAYS } from "@/lib/site-analytics";

export const metadata = buildPageMetadata({
  title: "Política de cookies",
  description: "Quais cookies e dados de navegador a RARE usa, para quê, por quanto tempo e como mudar a sua escolha.",
  path: "/politica-de-cookies",
});

const kindLabels = { cookie: "Cookie", localStorage: "Armazenamento local", sessionStorage: "Armazenamento da sessão" } as const;

// Built from COOKIE_CATALOG, the same list the preferences panel shows. A test fails when the app
// stores something that is not listed there, so this page describes what the site really does.
export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">RARE</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">Política de cookies</h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-neutral-600 sm:text-lg">
          A RARE guarda no seu navegador apenas o necessário para a loja funcionar e, se você permitir, identificadores aleatórios para medir o uso do site.
          Não usamos cookies de publicidade nem ferramentas de análise de terceiros.
        </p>
        <div className="mt-8">
          <CookiePreferencesButton className="inline-flex min-h-11 items-center rounded-lg bg-black px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2" />
        </div>
      </section>

      {COOKIE_CATALOG.map((category) => (
        <section key={category.id} aria-labelledby={`cookies-${category.id}`} className="mt-12 border-t border-neutral-200 pt-8">
          <h2 id={`cookies-${category.id}`} className="text-2xl font-black tracking-tight text-neutral-950">
            {category.label} {category.required ? <span className="text-base text-neutral-500">(sempre ativos)</span> : <span className="text-base text-neutral-500">(opcional)</span>}
          </h2>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-neutral-600">{category.purpose}</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">{`${category.label}: nome, tipo, finalidade, duração e origem`}</caption>
              <thead>
                <tr className="border-b border-neutral-300 text-[11px] font-black uppercase tracking-wide text-neutral-600">
                  <th scope="col" className="py-2 pr-4">Nome</th>
                  <th scope="col" className="py-2 pr-4">Tipo</th>
                  <th scope="col" className="py-2 pr-4">Finalidade</th>
                  <th scope="col" className="py-2 pr-4">Duração</th>
                  <th scope="col" className="py-2">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 align-top">
                {category.entries.map((entry) => (
                  <tr key={entry.name}>
                    <td className="break-all py-3 pr-4 font-mono text-xs font-bold text-neutral-950">{entry.name}</td>
                    <td className="py-3 pr-4 font-semibold text-neutral-700">{kindLabels[entry.kind]}</td>
                    <td className="py-3 pr-4 font-semibold leading-6 text-neutral-700">{entry.purpose}</td>
                    <td className="py-3 pr-4 font-semibold text-neutral-700">{entry.duration}</td>
                    <td className="py-3 font-semibold text-neutral-700">{entry.party}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section aria-labelledby="cookies-choice" className="mt-12 border-t border-neutral-200 pt-8">
        <h2 id="cookies-choice" className="text-2xl font-black tracking-tight text-neutral-950">Sua escolha</h2>
        <ul className="mt-4 grid max-w-2xl gap-3 text-base font-semibold leading-8 text-neutral-600">
          <li>Sem a sua escolha, nada opcional é ativado: a análise de uso começa desligada.</li>
          <li>Recusar é tão simples quanto aceitar e não muda nada na compra.</li>
          <li>Ao recusar ou retirar o consentimento, os identificadores de análise são apagados deste navegador e nenhum evento novo é enviado.</li>
          <li>A sua decisão fica guardada por {COOKIE_CONSENT_MAX_AGE_DAYS} dias, sem dado pessoal; depois perguntamos de novo. Você pode mudar a qualquer momento em “Preferências de Cookies”, no rodapé.</li>
          <li>Eventos de análise já registrados não identificam você e são apagados após {SITE_ANALYTICS_RETENTION_DAYS} dias.</li>
          <li>Pedidos, pagamentos e entregas usam os dados da compra conforme a página Privacidade e termos, independentemente desta escolha.</li>
        </ul>
      </section>
    </div>
  );
}

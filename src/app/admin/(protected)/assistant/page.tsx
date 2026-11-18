import {
  createAssistantEntryAction,
  saveAssistantConfigAction,
  setAssistantEntryActiveAction,
  updateAssistantEntryAction,
} from "@/app/admin/(protected)/assistant/actions";
import { AssistantPreview } from "@/app/admin/(protected)/assistant/assistant-preview";
import { AssistantEntryFields } from "@/app/admin/(protected)/assistant/entry-fields";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ASSISTANT_LIMITS } from "@/lib/assistant/limits";
import { readAssistantConfig } from "@/lib/assistant/store";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const sectionClass = "scroll-mt-24 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5";
const label = "mb-1.5 block text-xs font-black uppercase tracking-wide text-neutral-500";
const primaryButton = "h-12 rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const secondaryButton =
  "h-11 rounded-lg border border-neutral-300 px-4 text-xs font-black hover:bg-neutral-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const CATEGORY_LIST_ID = "assistant-category-options";
const SUGGESTED_CATEGORIES = ["Produtos", "Pedidos", "Pagamento", "Entrega", "Trocas", "Devoluções", "Conta", "Outros"];

// Admin → Sistema → Assistente Virtual. SYSTEM_ADMIN only: the page checks "system.assistant"
// itself (a layout is not re-rendered on client navigation), and so does every action.
export default async function AdminAssistantPage() {
  await requireAdmin("system.assistant");
  const [config, entries] = await Promise.all([
    readAssistantConfig(),
    prisma.virtualAssistantEntry.findMany({
      orderBy: [{ active: "desc" }, { priority: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, question: true, answer: true, category: true, keywords: true, active: true, priority: true, sortOrder: true, updatedAt: true },
    }),
  ]);
  const activeCount = entries.filter((entry) => entry.active).length;
  const categories = Array.from(new Set([...SUGGESTED_CATEGORIES, ...entries.map((entry) => entry.category).filter((value): value is string => Boolean(value))]));

  return (
    <div className="min-w-0 max-w-5xl [overflow-wrap:anywhere]">
      <datalist id={CATEGORY_LIST_ID}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-neutral-950">Assistente Virtual</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">
            Responde dúvidas na loja usando somente as respostas cadastradas aqui. Sem inteligência artificial externa: quando nenhuma resposta é confiável, mostra a
            mensagem padrão e o botão de suporte. As perguntas dos clientes não são guardadas.
          </p>
        </div>
        <span
          className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black uppercase tracking-wide ${
            config.enabled ? "border-emerald-500 text-emerald-700" : "border-neutral-300 text-neutral-600"
          }`}
          data-assistant-status={config.enabled ? "enabled" : "disabled"}
        >
          {config.enabled ? "Ativo na loja" : "Desativado"}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Respostas ativas</dt>
          <dd className="mt-1 text-2xl font-black text-neutral-950">{activeCount}</dd>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Desativadas</dt>
          <dd className="mt-1 text-2xl font-black text-neutral-950">{entries.length - activeCount}</dd>
        </div>
        <div className="col-span-2 rounded-lg border border-neutral-200 bg-white p-4 sm:col-span-1">
          <dt className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Sugestões na loja</dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-700">As {ASSISTANT_LIMITS.suggestions} ativas de maior prioridade</dd>
        </div>
      </dl>

      <section id="configuracao" aria-labelledby="assistant-config-title" className={`mt-6 ${sectionClass}`}>
        <h2 id="assistant-config-title" className="text-lg font-black text-neutral-950">Configuração geral</h2>
        <form action={saveAssistantConfigAction} className="mt-4 grid gap-4">
          <label className="inline-flex min-h-11 items-center gap-3 text-sm font-black text-neutral-900" htmlFor="assistant-enabled">
            <input id="assistant-enabled" name="enabled" type="checkbox" defaultChecked={config.enabled} className="h-5 w-5 accent-black" />
            Mostrar o Assistente na loja
          </label>
          {activeCount === 0 ? (
            <p className="text-xs font-semibold text-amber-700">Para ativar, cadastre e ative ao menos uma resposta abaixo.</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="assistant-display-name">
              <span className={label}>Nome exibido</span>
              <input id="assistant-display-name" name="displayName" required maxLength={ASSISTANT_LIMITS.displayName} defaultValue={config.displayName} className="admin-input" />
            </label>
            <label className="block" htmlFor="assistant-placeholder">
              <span className={label}>Texto do campo de digitação</span>
              <input id="assistant-placeholder" name="inputPlaceholder" required maxLength={ASSISTANT_LIMITS.inputPlaceholder} defaultValue={config.inputPlaceholder} className="admin-input" />
            </label>
          </div>
          <label className="block" htmlFor="assistant-welcome">
            <span className={label}>Mensagem de boas-vindas</span>
            <textarea id="assistant-welcome" name="welcomeMessage" required rows={3} maxLength={ASSISTANT_LIMITS.welcomeMessage} defaultValue={config.welcomeMessage} className="admin-input" />
          </label>
          <label className="block" htmlFor="assistant-fallback">
            <span className={label}>Resposta quando não houver uma resposta confiável</span>
            <textarea id="assistant-fallback" name="fallbackMessage" required rows={3} maxLength={ASSISTANT_LIMITS.fallbackMessage} defaultValue={config.fallbackMessage} className="admin-input" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block" htmlFor="assistant-cta-label">
              <span className={label}>Botão de suporte — texto</span>
              <input id="assistant-cta-label" name="supportCtaLabel" required maxLength={ASSISTANT_LIMITS.supportCtaLabel} defaultValue={config.supportCtaLabel} className="admin-input" />
            </label>
            <div className="block">
              <label htmlFor="assistant-cta-href" className={label}>Botão de suporte — destino</label>
              <input
                id="assistant-cta-href"
                name="supportCtaHref"
                required
                aria-describedby="assistant-cta-href-hint"
                maxLength={ASSISTANT_LIMITS.supportCtaHref}
                defaultValue={config.supportCtaHref}
                pattern="(/(?!/)[^\s\\]*|https://[^\s\\]+)"
                title="Use um caminho do site (ex.: /suporte) ou um endereço https://"
                className="admin-input"
              />
              <p id="assistant-cta-href-hint" className="mt-1.5 text-xs text-neutral-500">Caminho do site (ex.: /suporte) ou endereço https://.</p>
            </div>
          </div>
          <div>
            <AdminSubmitButton idleLabel="Salvar configuração" pendingLabel="Salvando..." className={primaryButton} />
          </div>
        </form>
      </section>

      <section id="testar" aria-labelledby="assistant-preview-title" className={`mt-6 ${sectionClass}`}>
        <h2 id="assistant-preview-title" className="text-lg font-black text-neutral-950">Testar Assistente</h2>
        <p className="mt-1 text-sm text-neutral-600">Usa exatamente a mesma busca da loja, com as respostas ativas agora. A confiança aparece só aqui, nunca para o cliente.</p>
        <div className="mt-4">
          <AssistantPreview />
        </div>
      </section>

      <section id="nova-pergunta" aria-labelledby="assistant-new-title" className={`mt-6 ${sectionClass}`}>
        <h2 id="assistant-new-title" className="text-lg font-black text-neutral-950">Nova pergunta</h2>
        <form action={createAssistantEntryAction} className="mt-4 grid gap-4">
          <AssistantEntryFields idPrefix="assistant-new" categoryListId={CATEGORY_LIST_ID} />
          <div>
            <AdminSubmitButton idleLabel="Criar pergunta" pendingLabel="Criando..." className={primaryButton} />
          </div>
        </form>
      </section>

      <section id="perguntas" aria-labelledby="assistant-entries-title" className="mt-6 scroll-mt-24">
        <h2 id="assistant-entries-title" className="text-lg font-black text-neutral-950">Perguntas e respostas ({entries.length})</h2>
        {entries.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-white p-5 text-sm font-semibold text-neutral-600">
            Nenhuma pergunta cadastrada ainda. Comece pelas dúvidas mais comuns: entrega, pagamento, trocas e acompanhamento do pedido.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {entries.map((entry) => (
              <li key={entry.id} id={`pergunta-${entry.id}`} className="min-w-0 scroll-mt-24 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5" data-assistant-entry={entry.active ? "active" : "inactive"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-neutral-950">{entry.question}</h3>
                    <p className="mt-1 text-xs font-semibold text-neutral-500">
                      {entry.active ? "Ativa" : "Desativada"} · Prioridade {entry.priority} · Ordem {entry.sortOrder}
                      {entry.category ? ` · ${entry.category}` : ""}
                    </p>
                  </div>
                  <form action={setAssistantEntryActiveAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="active" value={entry.active ? "false" : "true"} />
                    <AdminSubmitButton idleLabel={entry.active ? "Desativar" : "Ativar"} pendingLabel="Salvando..." className={secondaryButton} />
                  </form>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-neutral-700">{entry.answer}</p>
                {entry.keywords.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Palavras-chave">
                    {entry.keywords.map((keyword) => (
                      <li key={keyword} className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-[11px] font-black text-neutral-700">
                        {keyword}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-amber-700">Sem palavras-chave: só perguntas muito parecidas com a cadastrada vão encontrar esta resposta.</p>
                )}
                <details className="mt-4 border-t border-neutral-200 pt-3">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-black text-neutral-900">Editar</summary>
                  <form action={updateAssistantEntryAction} className="mt-3 grid gap-4">
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="version" value={entry.updatedAt.toISOString()} />
                    <AssistantEntryFields idPrefix={`assistant-${entry.id}`} values={entry} categoryListId={CATEGORY_LIST_ID} />
                    <div>
                      <AdminSubmitButton idleLabel="Salvar pergunta" pendingLabel="Salvando..." className={primaryButton} />
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

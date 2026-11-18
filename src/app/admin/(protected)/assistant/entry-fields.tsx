import { ASSISTANT_LIMITS } from "@/lib/assistant/limits";
import { ASSISTANT_PRIORITY_MAX } from "@/lib/assistant/matching";

const label = "mb-1.5 block text-xs font-black uppercase tracking-wide text-neutral-500";
const hint = "mt-1.5 text-xs text-neutral-500";

export type AssistantEntryFormValues = {
  question: string;
  answer: string;
  category: string | null;
  keywords: readonly string[];
  active: boolean;
  priority: number;
  sortOrder: number;
};

/** The question/answer fields shared by "Nova pergunta" and each entry's edit form. */
export function AssistantEntryFields({ idPrefix, values, categoryListId }: { idPrefix: string; values?: AssistantEntryFormValues; categoryListId: string }) {
  return (
    <div className="grid gap-4">
      <div className="block">
        <label htmlFor={`${idPrefix}-question`} className={label}>Pergunta</label>
        <input
          id={`${idPrefix}-question`}
          aria-describedby={`${idPrefix}-question-hint`}
          name="question"
          required
          minLength={3}
          maxLength={ASSISTANT_LIMITS.question}
          defaultValue={values?.question}
          placeholder="Qual o prazo de entrega?"
          className="admin-input"
        />
        <p id={`${idPrefix}-question-hint`} className={hint}>Aparece como sugestão na loja quando a resposta está ativa e entre as mais prioritárias.</p>
      </div>
      <div className="block">
        <label htmlFor={`${idPrefix}-answer`} className={label}>Resposta</label>
        <textarea
          id={`${idPrefix}-answer`}
          aria-describedby={`${idPrefix}-answer-hint`}
          name="answer"
          required
          rows={5}
          maxLength={ASSISTANT_LIMITS.answer}
          defaultValue={values?.answer}
          className="admin-input"
        />
        <p id={`${idPrefix}-answer-hint`} className={hint}>Somente texto (sem HTML). Quebras de linha são mantidas. Até {ASSISTANT_LIMITS.answer} caracteres.</p>
      </div>
      <div className="block">
        <label htmlFor={`${idPrefix}-keywords`} className={label}>Palavras-chave e sinônimos</label>
        <textarea
          id={`${idPrefix}-keywords`}
          aria-describedby={`${idPrefix}-keywords-hint`}
          name="keywords"
          rows={2}
          defaultValue={values?.keywords.join(", ")}
          placeholder="entrega, prazo, frete, chegar, demora, envio"
          className="admin-input"
        />
        <p id={`${idPrefix}-keywords-hint`} className={hint}>
          Separe por vírgula ou uma por linha (até {ASSISTANT_LIMITS.keywords}). Acentos e maiúsculas não importam; palavras muito comuns (“como”, “qual”, “de”) são ignoradas.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block" htmlFor={`${idPrefix}-category`}>
          <span className={label}>Categoria</span>
          <input
            id={`${idPrefix}-category`}
            name="category"
            list={categoryListId}
            maxLength={ASSISTANT_LIMITS.category}
            defaultValue={values?.category ?? ""}
            placeholder="Entrega"
            className="admin-input"
          />
        </label>
        <label className="block" htmlFor={`${idPrefix}-priority`}>
          <span className={label}>Prioridade (0–{ASSISTANT_PRIORITY_MAX})</span>
          <input
            id={`${idPrefix}-priority`}
            name="priority"
            type="number"
            inputMode="numeric"
            min={0}
            max={ASSISTANT_PRIORITY_MAX}
            step={1}
            defaultValue={values?.priority ?? 0}
            className="admin-input"
          />
        </label>
        <label className="block" htmlFor={`${idPrefix}-sort`}>
          <span className={label}>Ordem</span>
          <input
            id={`${idPrefix}-sort`}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            max={ASSISTANT_LIMITS.sortOrder}
            step={1}
            defaultValue={values?.sortOrder ?? 0}
            className="admin-input"
          />
        </label>
      </div>
      <p className="text-xs text-neutral-500">
        Prioridade desempata respostas parecidas (a maior vence); ela nunca faz uma resposta fraca aparecer. Ordem define a sequência entre respostas de mesma prioridade.
      </p>
      <label className="inline-flex min-h-11 items-center gap-3 text-sm font-black text-neutral-900" htmlFor={`${idPrefix}-active`}>
        <input id={`${idPrefix}-active`} name="active" type="checkbox" defaultChecked={values?.active ?? true} className="h-5 w-5 accent-black" />
        Ativa (pode ser usada na loja)
      </label>
    </div>
  );
}

import { saveCardInstallmentSettingsAction, saveSettingsAction } from "@/app/admin/(protected)/settings/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { formatCep } from "@/lib/cep";
import { formatMoney } from "@/lib/money";
import { getStoreSettings } from "@/lib/settings";
import { getInstagramUrl } from "@/lib/store-social";
import { getEffectiveFixedShippingInCents, getEffectiveFreeShippingThresholdInCents } from "@/lib/shipping";
import { requireAdmin } from "@/lib/auth";
import { isCardInstallmentsEnabled } from "@/lib/env";
import { CARD_INSTALLMENTS_INTEREST_FREE, describeCardInstallmentPlan, formatBpsAsPercent, listCardInstallmentPlans, resolveCardInstallmentRules } from "@/lib/card-installments";
import { cardInstallmentSettingsErrorMessage } from "@/lib/card-installment-settings";

export const dynamic = "force-dynamic";

type SettingsSearchParams = { success?: string | string[]; error?: string | string[]; code?: string | string[] };
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const PREVIEW_BASE_IN_CENTS = 60_000;

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<SettingsSearchParams> }) {
  // Checked here, not only in the layout: layouts do not re-render on client
  // navigation, so every page verifies the session next to its data.
  await requireAdmin("system.settings");
  const params = (await searchParams) ?? {};
  const settings = await getStoreSettings();
  const fixedShippingInCents = getEffectiveFixedShippingInCents(settings);
  const freeShippingThresholdInCents = getEffectiveFreeShippingThresholdInCents(settings);
  const installmentsFlag = isCardInstallmentsEnabled();
  const installmentsError = first(params.error) === "installments" ? cardInstallmentSettingsErrorMessage(first(params.code)) : null;
  const installmentsSaved = first(params.success) === "installments-saved";
  // Preview of what a R$ 600,00 order would offer with the SAVED rules (as if the flag were on).
  const previewPlans = listCardInstallmentPlans(PREVIEW_BASE_IN_CENTS, resolveCardInstallmentRules(true, { ...settings, cardInstallmentsEnabled: true }));
  const rateValue = (bps: number | null) => (bps === null ? "" : formatBpsAsPercent(bps).replace("%", ""));

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Configurações</h1>
      <form action={saveSettingsAction} className="mt-6 max-w-3xl space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Instagram da loja</span>
          <input name="instagramUrl" type="url" required defaultValue={getInstagramUrl(settings.instagramUrl)} className="admin-input" />
          <span className="mt-2 block text-xs text-neutral-500">Perfil usado no rodapé, contato e dados públicos da loja.</span>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Nome da loja</span>
          <input name="storeName" defaultValue={settings.storeName} className="admin-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">WhatsApp de atendimento</span>
          <input name="whatsappNumber" defaultValue={settings.whatsappNumber ?? ""} placeholder="5511999999999" className="admin-input" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Mensagem padrão WhatsApp</span>
          <textarea name="whatsappDefaultMessage" defaultValue={settings.whatsappDefaultMessage} rows={3} className="admin-input" />
        </label>

        <section className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div>
            <h2 className="text-lg font-black text-neutral-950">Frete automático</h2>
            <p className="mt-1 text-sm font-semibold text-neutral-500">
              O checkout recalcula o frete no backend. Use Melhor Envio em produção e mantenha manual/fixo apenas como legado ou homologação.
            </p>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">CEP de origem</span>
            <input name="originCep" defaultValue={formatCep(settings.originCep) || ""} placeholder="00000-000" inputMode="numeric" className="admin-input" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Provider ativo</span>
            <select name="shippingMode" defaultValue={settings.shippingMode} className="admin-input">
              <option value="disabled">Desativado / combinar entrega</option>
              <option value="manual">Manual/fallback PAC e SEDEX</option>
              <option value="fixed">Fixo legado</option>
              <option value="correios">Correios via env</option>
              <option value="melhor_envio">Melhor Envio automático via env</option>
              <option value="frenet">Frenet via env</option>
              <option value="future_provider">Legado: futuro provedor real</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Valor fixo legado</span>
              <input name="fixedShipping" defaultValue={formatMoney(fixedShippingInCents)} className="admin-input" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Frete gratis acima de</span>
              <input
                name="freeShippingThreshold"
                defaultValue={freeShippingThresholdInCents ? formatMoney(freeShippingThresholdInCents) : ""}
                className="admin-input"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Instrucoes de frete</span>
            <textarea
              name="shippingInstructions"
              defaultValue={settings.shippingInstructions ?? ""}
              rows={3}
              placeholder="Ex.: prazo e valor final podem ser confirmados pelo atendimento."
              className="admin-input"
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="checkoutRequiresAddress" type="checkbox" defaultChecked={settings.checkoutRequiresAddress} className="h-4 w-4" />
            Exigir endereco no checkout
          </label>
        </section>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Reserva do checkout (minutos)</span>
          <input
            name="checkoutReservationMinutes"
            type="number"
            value={15}
            readOnly
            className="admin-input"
          />
          <p className="mt-2 text-xs text-neutral-600">Novas compras: 15 minutos, com encerramento confirmado no provedor. Pedidos anteriores mantêm o prazo original; login e pagamentos em processamento têm prazos próprios.</p>
        </label>
        <AdminSubmitButton
          idleLabel="Salvar configurações"
          pendingLabel="Salvando..."
          className="h-12 rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
        />
      </form>

      <section id="parcelamento" className="mt-10 max-w-3xl scroll-mt-24">
        <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Pagamentos · Cartão de crédito</p>
        <h2 className="mt-1 text-xl font-black text-neutral-950">Parcelamento no cartão</h2>
        <p className="mt-2 text-sm font-semibold text-neutral-600">
          1x a {CARD_INSTALLMENTS_INTEREST_FREE}x são sempre sem juros (a RARE absorve a taxa do cartão). De 4x a 6x, o acréscimo é o percentual total somado ao valor do pedido, depois de cupom e frete. Vale só para pedidos novos.
        </p>
        {!installmentsFlag ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
            O parcelamento está desligado neste ambiente. As regras ficam salvas, mas o checkout continua só com cartão à vista até a ativação.
          </p>
        ) : null}
        {installmentsError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{installmentsError}</p> : null}
        {installmentsSaved ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">Parcelamento salvo.</p> : null}
        <form action={saveCardInstallmentSettingsAction} className="mt-4 space-y-5 rounded-lg border border-neutral-200 bg-white p-5">
          <label className="flex items-center gap-3 text-sm font-black text-neutral-800">
            <input name="cardInstallmentsEnabled" type="checkbox" defaultChecked={settings.cardInstallmentsEnabled} className="h-4 w-4" />
            Parcelamento ativado
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Máximo de parcelas</span>
              <select name="cardInstallmentsMax" defaultValue={String(settings.cardInstallmentsMax)} className="admin-input">
                {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}x</option>)}
              </select>
            </label>
            <div className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Sem juros até</span>
              <p className="admin-input flex items-center bg-neutral-50 text-neutral-700">{CARD_INSTALLMENTS_INTEREST_FREE}x</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Valor mínimo por parcela</span>
              <input name="cardInstallmentsMin" inputMode="decimal" required defaultValue={formatMoney(settings.cardInstallmentsMinInCents)} className="admin-input" />
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Acréscimo total (%)</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {([[4, "rate4x", settings.cardInstallment4xBps], [5, "rate5x", settings.cardInstallment5xBps], [6, "rate6x", settings.cardInstallment6xBps]] as const).map(([count, name, bps]) => (
                <label key={name} className="block">
                  <span className="mb-1 block text-sm font-black text-neutral-800">{count}x</span>
                  <input name={name} inputMode="decimal" placeholder="Ex.: 8,5" defaultValue={rateValue(bps)} className="admin-input" aria-describedby="parcelamento-ajuda" />
                </label>
              ))}
            </div>
            <p id="parcelamento-ajuda" className="mt-2 text-xs text-neutral-500">Entre 0% e 30%. Deixe em branco para não oferecer aquela parcela (o máximo precisa ser menor).</p>
          </fieldset>
          <div className="rounded-lg bg-neutral-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Exemplo: pedido de {formatMoney(PREVIEW_BASE_IN_CENTS)}</p>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-neutral-700">
              {previewPlans.map((plan) => <li key={plan.installmentCount}>{describeCardInstallmentPlan(plan)}</li>)}
            </ul>
          </div>
          <AdminSubmitButton
            idleLabel="Salvar parcelamento"
            pendingLabel="Salvando..."
            className="h-12 rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
          />
        </form>
      </section>
    </div>
  );
}

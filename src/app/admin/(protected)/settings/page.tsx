import { saveSettingsAction } from "@/app/admin/(protected)/settings/actions";
import { formatCep } from "@/lib/cep";
import { formatMoney } from "@/lib/money";
import { getStoreSettings } from "@/lib/settings";
import { getEffectiveFixedShippingInCents, getEffectiveFreeShippingThresholdInCents } from "@/lib/shipping";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getStoreSettings();
  const fixedShippingInCents = getEffectiveFixedShippingInCents(settings);
  const freeShippingThresholdInCents = getEffectiveFreeShippingThresholdInCents(settings);

  return (
    <div>
      <h1 className="text-2xl font-black text-neutral-950">Configurações</h1>
      <form action={saveSettingsAction} className="mt-6 max-w-3xl space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
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
            <h2 className="text-lg font-black text-neutral-950">Frete provisorio</h2>
            <p className="mt-1 text-sm font-semibold text-neutral-500">
              Cotacao real, prazo automatico e etiqueta ficam para fase futura. Nesta versao o checkout usa regra fixa/manual no backend.
            </p>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">CEP de origem</span>
            <input name="originCep" defaultValue={formatCep(settings.originCep) || ""} placeholder="00000-000" inputMode="numeric" className="admin-input" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Modo de frete</span>
            <select name="shippingMode" defaultValue={settings.shippingMode} className="admin-input">
              <option value="disabled">Desativado / combinar entrega</option>
              <option value="manual">Manual provisorio</option>
              <option value="fixed">Fixo provisorio</option>
              <option value="future_provider">Futuro provedor real</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">Valor fixo de frete</span>
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
            min={30}
            max={1440}
            defaultValue={settings.checkoutReservationMinutes}
            className="admin-input"
          />
        </label>
        <button className="h-12 rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white">
          Salvar configurações
        </button>
      </form>
    </div>
  );
}

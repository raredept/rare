/**
 * RARE-CARD-INSTALLMENTS-01 — real Asaas SANDBOX proofs (never production).
 *
 *   tsx scripts/qa-card-installments-sandbox.ts create <env.json>   creates 1x, 3x, 4x, 6x, 7x and 12x charges
 *   tsx scripts/qa-card-installments-sandbox.ts verify <env.json>   re-reads them and applies the store's matching rules
 *   tsx scripts/qa-card-installments-sandbox.ts cleanup <env.json>  removes the still-unpaid ones
 *
 * <env.json> holds ASAAS_ENV / ASAAS_API_KEY / ASAAS_WEBHOOK_TOKEN of the SANDBOX account; it is read
 * once and deleted. Uses the store's own pricing (calculateCardInstallmentPlan) and Asaas transport
 * (buildAsaasPaymentRequest via createAsaasPayment). Prints ids, statuses and amounts only.
 */
import { readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const [mode, envFile] = process.argv.slice(2);
if (!mode || !envFile) throw new Error("usage: create|verify|cleanup <env.json>");
const secrets = JSON.parse(readFileSync(envFile, "utf8")) as Record<string, string>;
rmSync(envFile);
if (secrets.ASAAS_ENV !== "sandbox" || !secrets.ASAAS_API_KEY?.trim().startsWith("$aact_hmlg_")) {
  throw new Error("Refusing: this script runs only against the Asaas SANDBOX.");
}
Object.assign(process.env, { APP_ENV: "staging", ASAAS_ENV: "sandbox", ASAAS_API_KEY: secrets.ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN: secrets.ASAAS_WEBHOOK_TOKEN });

const STATE = path.join(process.env.QA_STATE_DIR ?? ".", "qa-card-installments-sandbox.json");
// The owner-approved table (1x-3x 0%, 4x 9% ... 12x 18%), minimum R$ 10 per installment.
const RULES_MAX = 12;
const RULES_MIN_INSTALLMENT_IN_CENTS = 1_000;
const BASE_IN_CENTS = 22_000; // R$ 200,00 + R$ 20,00 frete (example base)
const COUNTS = [1, 3, 4, 6, 7, 12];

type Proof = { count: number; reference: string; paymentId: string; installmentId: string | null; financedTotalInCents: number; feeInCents: number };

async function main() {
  const asaas = await import("../src/lib/asaas");
  const { APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS, calculateCardInstallmentPlan } = await import("../src/lib/card-installments");
  const RULES = { enabled: true, maxInstallments: RULES_MAX, minInstallmentInCents: RULES_MIN_INSTALLMENT_IN_CENTS, surchargeBps: APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS };
  const { classifyAsaasPayment, isAsaasPlanForOrder } = await import("../src/lib/checkout");
  const config = asaas.getAsaasConfig();
  if (config.environment !== "sandbox") throw new Error("Refusing: not sandbox.");

  if (mode === "create") {
    const response = await fetch(`${config.apiBase}/customers?limit=1`, { headers: { access_token: config.apiKey, accept: "application/json", "user-agent": "rare-qa" } });
    const customerId = ((await response.json()) as { data?: Array<{ id: string }> }).data?.[0]?.id;
    if (!customerId) throw new Error("No sandbox customer.");
    const proofs: Proof[] = [];
    for (const count of COUNTS) {
      const plan = calculateCardInstallmentPlan(BASE_IN_CENTS, count, RULES);
      const reference = `rare-qa-inst-${count}x-${Date.now()}`;
      const payment = await asaas.createAsaasPayment(config, {
        customerId, orderId: reference, orderNumber: `QA-${count}X`, totalInCents: plan.financedTotalInCents, method: "card",
        installmentCount: count, dueDate: new Date(Date.now() + 2 * 86_400_000),
      });
      proofs.push({ count, reference, paymentId: payment.id, installmentId: payment.installmentId ?? null, financedTotalInCents: plan.financedTotalInCents, feeInCents: plan.feeInCents });
      console.log(`${count}x created: plan base R$ ${(BASE_IN_CENTS / 100).toFixed(2)} + fee R$ ${(plan.feeInCents / 100).toFixed(2)} = R$ ${(plan.financedTotalInCents / 100).toFixed(2)}; first payment value R$ ${((payment.amountInCents ?? 0) / 100).toFixed(2)}; installment plan: ${payment.installmentId ? "yes" : "no"}; invoice host: ${payment.invoiceUrl ? new URL(payment.invoiceUrl).host : "-"}`);
      if (payment.invoiceUrl) console.log(`   invoice path: ${new URL(payment.invoiceUrl).pathname}`);
    }
    writeFileSync(STATE, JSON.stringify({ customerId, proofs }, null, 2));
    return;
  }

  if (!existsSync(STATE)) throw new Error("Run create first.");
  const { customerId, proofs } = JSON.parse(readFileSync(STATE, "utf8")) as { customerId: string; proofs: Proof[] };
  for (const proof of proofs) {
    const payments = await asaas.findAsaasPaymentsForOrder(config, proof.reference);
    const first = await asaas.getAsaasPayment(config, proof.paymentId);
    const plan = proof.installmentId ? await asaas.getAsaasInstallmentOrDeleted(config, proof.installmentId) : null;
    if (mode === "verify") {
      const sum = payments.reduce((total, payment) => total + (payment.amountInCents ?? 0), 0);
      const amountRule = proof.count > 1
        ? isAsaasPlanForOrder(plan, { totalInCents: proof.financedTotalInCents, installmentCount: proof.count, asaasCustomerId: customerId })
        : first.amountInCents === proof.financedTotalInCents && !first.installmentId;
      console.log(JSON.stringify({
        count: proof.count,
        billingType: first.billingType,
        installmentCount: plan?.installmentCount ?? 1,
        totalValue: plan ? plan.totalInCents : first.amountInCents,
        expectedTotal: proof.financedTotalInCents,
        paymentsUnderReference: payments.length,
        sumOfInstallments: sum,
        externalReferenceOnAll: payments.every((payment) => payment.externalReference === proof.reference),
        statuses: [...new Set(payments.map((payment) => payment.status))],
        storeOutcome: classifyAsaasPayment(first),
        storeAmountRule: amountRule ? "MATCH" : "MISMATCH",
        // A plan priced WITHOUT the surcharge must never be accepted for a surcharged order.
        withoutSurchargeRejected: proof.feeInCents > 0 ? !isAsaasPlanForOrder(plan, { totalInCents: proof.financedTotalInCents - proof.feeInCents, installmentCount: proof.count, asaasCustomerId: customerId }) : "n/a",
      }));
    } else if (mode === "cleanup") {
      const unpaid = classifyAsaasPayment(first) === "pending";
      if (!unpaid) { console.log(`${proof.count}x kept (${first.status})`); continue; }
      const removed = proof.installmentId ? await asaas.deleteAsaasInstallment(config, proof.installmentId) : await asaas.deleteAsaasPayment(config, proof.paymentId);
      console.log(`${proof.count}x removed: ${removed}`);
    }
  }
}

main().catch((error) => {
  console.error("FAILED", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
  process.exit(1);
});

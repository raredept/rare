// RARE-UIUX-REFINE-01 — UIUX-PDP-002 proof against the 75 real prices collected in production by the
// audit (output/uiux-audit-01/pdp-installments.json, local and unversioned). Read only; no network.
//   npx tsx tests/uiux-audit/pdp-installments-after.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCardInstallmentHint } from "@/components/store/card-installment-hint";
import { APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS, listCardInstallmentPlans, type CardInstallmentRules } from "@/lib/card-installments";

const source = path.resolve("output/uiux-audit-01/pdp-installments.json");
if (!existsSync(source)) {
  console.log("SKIP: output/uiux-audit-01/pdp-installments.json not found");
  process.exit(0);
}
const rules: CardInstallmentRules = { enabled: true, maxInstallments: 12, minInstallmentInCents: 1_000, surchargeBps: APPROVED_CARD_INSTALLMENT_SURCHARGES_BPS };
const rows = JSON.parse(readFileSync(source, "utf8")) as Array<{ slug: string; price: number; hint: string | null }>;
const after = rows.map((row) => {
  const cents = Math.round(row.price * 100);
  const hint = buildCardInstallmentHint({ amountInCents: cents, rules, context: "product" });
  const max = listCardInstallmentPlans(cents, rules).at(-1)?.installmentCount ?? 1;
  const promised = Number(/até (\d+)x no cartão/.exec(hint ?? "")?.[1] ?? /até (\d+)x sem juros/.exec(hint ?? "")?.[1] ?? 1);
  return { slug: row.slug, price: row.price, before: row.hint, after: hint, maxFeasibleItemOnly: max, promised, honest: promised === max };
});
mkdirSync(path.resolve("output/uiux-refine-01"), { recursive: true });
writeFileSync(path.resolve("output/uiux-refine-01/pdp-installments-after.json"), JSON.stringify(after, null, 2));
const dishonest = after.filter((row) => !row.honest);
const changed = after.filter((row) => row.before !== row.after);
console.log(JSON.stringify({ prices: after.length, dishonestAfter: dishonest.length, changed: changed.map((row) => `${row.slug} R$ ${row.price}: "${row.before}" -> "${row.after}"`) }, null, 1));
process.exit(dishonest.length ? 1 : 0);

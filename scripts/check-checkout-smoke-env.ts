import "dotenv/config";
import { validateCheckoutSmokeEnvironment } from "../src/lib/stripe-smoke-guard";

const result = validateCheckoutSmokeEnvironment();

console.log("Checkout smoke guard");
console.log(`- Stripe mode: ${result.stripeMode}`);
console.log(`- NODE_ENV: ${result.nodeEnv}`);
console.log(`- APP_ENV/RAILWAY_ENVIRONMENT_NAME: ${result.appEnvironment}`);
console.log(`- App origin: ${result.appUrlOrigin}`);
console.log(`- Webhook origin: ${result.webhookUrlOrigin}`);
console.log(`- Database target: ${result.databaseTarget}`);

for (const issue of result.warnings) {
  console.warn(`[WARN] ${issue.variable}: ${issue.message}`);
}

for (const issue of result.errors) {
  console.error(`[ERROR] ${issue.variable}: ${issue.message}`);
}

if (!result.ok) {
  console.error("Checkout smoke guard blocked execution.");
  process.exit(1);
}

console.log("Checkout smoke guard passed. Continue only with Stripe test-mode cards and test data.");

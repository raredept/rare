import "dotenv/config";
import {
  formatPublicSmokeReport,
  hasPublicSmokeFailure,
  resolvePublicSmokeBaseUrl,
  runPublicSiteSmoke,
} from "../src/lib/public-site-smoke";

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0] : "Unknown error.";
}

async function main() {
  const cliUrl = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  const baseUrl = resolvePublicSmokeBaseUrl(cliUrl);
  const result = await runPublicSiteSmoke({ baseUrl });

  console.log(formatPublicSmokeReport(result));

  if (hasPublicSmokeFailure(result)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`FAIL smoke: ${safeErrorMessage(error)}`);
  process.exit(1);
});

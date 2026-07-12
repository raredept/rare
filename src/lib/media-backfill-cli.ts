export const MEDIA_BACKFILL_DEFAULT_LIMIT = 10;
export const MEDIA_BACKFILL_MAX_LIMIT = 100;
export const MEDIA_BACKFILL_DEFAULT_MAX_SOURCE_MB = 25;

export type MediaBackfillArgs = { limit: number; dryRun: boolean; maxSourceBytes: number };

function getArgumentValue(argv: string[], name: string) {
  const inline = argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function parseMediaBackfillArgs(argv: string[], env: Record<string, string | undefined> = process.env): MediaBackfillArgs {
  const applying = argv.includes("--apply");
  if (applying && argv.includes("--dry-run")) throw new Error("Use --dry-run ou --apply, nunca os dois juntos.");
  const limit = Number(getArgumentValue(argv, "--limit") ?? MEDIA_BACKFILL_DEFAULT_LIMIT);
  if (!Number.isInteger(limit) || limit < 1 || limit > MEDIA_BACKFILL_MAX_LIMIT) {
    throw new Error(`--limit deve ser um inteiro entre 1 e ${MEDIA_BACKFILL_MAX_LIMIT}.`);
  }
  const maxSourceMb = Number(env.MEDIA_BACKFILL_MAX_SOURCE_MB ?? MEDIA_BACKFILL_DEFAULT_MAX_SOURCE_MB);
  if (!Number.isFinite(maxSourceMb) || maxSourceMb <= 0 || maxSourceMb > 100) {
    throw new Error("MEDIA_BACKFILL_MAX_SOURCE_MB deve ser um número entre 0 e 100.");
  }
  return { limit, dryRun: !applying, maxSourceBytes: Math.floor(maxSourceMb * 1024 * 1024) };
}

export function assertProductionMediaBackfillAuthorized(args: MediaBackfillArgs, env: Record<string, string | undefined> = process.env) {
  const environment = (env.APP_ENV ?? env.NODE_ENV ?? "development").toLowerCase();
  if (!args.dryRun && environment === "production" && env.MEDIA_BACKFILL_ALLOW_PRODUCTION !== "true") {
    throw new Error("Backfill em produção bloqueado. Exige autorização explícita e MEDIA_BACKFILL_ALLOW_PRODUCTION=true somente durante a execução aprovada.");
  }
}

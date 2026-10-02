import Link from "next/link";
import { buildAdminListHref } from "@/lib/admin-pagination";

export function AdminPagination({
  basePath,
  hasNextPage,
  page,
  params,
}: {
  basePath: string;
  hasNextPage: boolean;
  page: number;
  params: Record<string, string | number | undefined>;
}) {
  if (page === 1 && !hasNextPage) return null;

  return (
    <nav className="flex flex-col gap-3 border-t border-neutral-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-500">Página {page}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            rel="prev"
            href={buildAdminListHref(basePath, { ...params, page: page - 1 })}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-700 px-4 text-xs font-black text-neutral-200 transition hover:border-white"
          >
            Anterior
          </Link>
        ) : null}
        {hasNextPage ? (
          <Link
            rel="next"
            href={buildAdminListHref(basePath, { ...params, page: page + 1 })}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-xs font-black text-black transition hover:bg-neutral-200"
          >
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

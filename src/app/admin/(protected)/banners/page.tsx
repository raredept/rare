import { ArrowDown, ArrowUp, Eye, EyeOff, ImageOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  deleteBannerAction,
  moveBannerDownAction,
  moveBannerUpAction,
  toggleBannerActiveAction,
} from "@/app/admin/(protected)/banners/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { HomeBannerForm } from "@/components/admin/home-banner-form";
import { getAdminHomeBannerSlides, getHomeBannerSummary, type HomeBannerSlide } from "@/lib/home-banners";

export const dynamic = "force-dynamic";

type BannersPageProps = {
  searchParams?: Promise<{ edit?: string; error?: string }>;
};

export default async function BannersPage({ searchParams }: BannersPageProps = {}) {
  const params = (await searchParams) ?? {};
  const banners = await getAdminHomeBannerSlides();
  const editingBanner = params.edit ? banners.find((banner) => banner.id === params.edit) : undefined;
  const summary = getHomeBannerSummary(banners);
  const nextSortOrder = banners.length ? Math.max(...banners.map((banner) => banner.sortOrder)) + 10 : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Vitrine</p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950">Banners da Home</h1>
          <p className="mt-1 text-sm font-semibold text-neutral-500">Gerencie os slides principais exibidos na vitrine.</p>
        </div>
        {editingBanner ? (
          <Link
            href="/admin/banners"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-700 px-5 text-sm font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black"
          >
            Criar novo banner
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="Total de banners" value={summary.total} />
        <SummaryMetric label="Ativos" value={summary.active} />
        <SummaryMetric label="Ocultos" value={summary.hidden} />
        <SummaryMetric label="Sem imagem" value={summary.missingImage} />
      </div>

      <HomeBannerForm key={editingBanner?.id ?? "new"} banner={editingBanner} error={params.error} nextSortOrder={nextSortOrder} />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-300">Slides cadastrados</h2>
          <p className="mt-1 text-xs font-semibold text-neutral-500">A home usa apenas banners ativos, ordenados de cima para baixo.</p>
        </div>

        {banners.length ? (
          <div className="grid gap-4">
            {banners.map((banner, index) => (
              <BannerCard key={banner.id} banner={banner} isFirst={index === 0} isLast={index === banners.length - 1} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-950/70 px-6 py-14 text-center shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <h2 className="text-lg font-black text-neutral-100">Nenhum banner cadastrado.</h2>
            <p className="mt-2 text-sm font-semibold text-neutral-500">Crie o primeiro banner para destacar drops e campanhas na home.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-4 py-3 shadow-[0_14px_45px_rgba(0,0,0,0.22)]">
      <p className="text-xl font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

function BannerCard({ banner, isFirst, isLast }: { banner: HomeBannerSlide; isFirst: boolean; isLast: boolean }) {
  return (
    <article className="admin-banner-card grid gap-4 rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)] transition hover:border-neutral-700 hover:bg-neutral-950 lg:grid-cols-[220px_minmax(0,1fr)_260px] lg:items-center">
      <div className="grid gap-3 sm:grid-cols-[1fr_86px] lg:grid-cols-1">
        <BannerThumbnail url={banner.imageUrl} alt={banner.alt} label="Desktop" ratio="aspect-[16/8]" />
        <BannerThumbnail url={banner.mobileImageUrl} alt={banner.alt} label="Mobile" ratio="aspect-[9/12]" compact />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <Badge tone={banner.active ? "neutral" : "muted"}>{banner.active ? "Ativo" : "Oculto"}</Badge>
          {!banner.imageUrl ? <Badge tone="warning">Sem imagem</Badge> : null}
          <Badge tone="dark">Ordem {banner.sortOrder}</Badge>
        </div>
        <h3 className="mt-3 truncate text-lg font-black text-neutral-950">{banner.title || "Banner sem título"}</h3>
        <p className="mt-1 text-sm font-semibold text-neutral-500">{banner.eyebrow || "Eyebrow não informado"}</p>
        {banner.description ? <p className="mt-3 line-clamp-2 max-w-2xl text-sm font-semibold leading-6 text-neutral-500">{banner.description}</p> : null}
        <div className="mt-3 grid gap-1 text-xs font-bold text-neutral-500">
          <p>CTA: {banner.ctaLabel || "Sem CTA"}</p>
          <p className="truncate">Link: {banner.href || "Sem link"}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Link
          href={`/admin/banners?edit=${banner.id}`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <form action={moveBannerUpAction}>
            <input type="hidden" name="id" value={banner.id} />
            <AdminSubmitButton
              idleLabel="Subir"
              pendingLabel="Movendo..."
              disabled={isFirst}
              icon={<ArrowUp className="h-4 w-4" aria-hidden="true" />}
              className="min-h-10 w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 hover:border-neutral-300 hover:bg-white hover:text-black disabled:hover:border-neutral-700 disabled:hover:bg-transparent disabled:hover:text-neutral-200"
            />
          </form>
          <form action={moveBannerDownAction}>
            <input type="hidden" name="id" value={banner.id} />
            <AdminSubmitButton
              idleLabel="Descer"
              pendingLabel="Movendo..."
              disabled={isLast}
              icon={<ArrowDown className="h-4 w-4" aria-hidden="true" />}
              className="min-h-10 w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 hover:border-neutral-300 hover:bg-white hover:text-black disabled:hover:border-neutral-700 disabled:hover:bg-transparent disabled:hover:text-neutral-200"
            />
          </form>
        </div>

        <form action={toggleBannerActiveAction}>
          <input type="hidden" name="id" value={banner.id} />
          <input type="hidden" name="active" value={String(banner.active)} />
          <AdminSubmitButton
            idleLabel={banner.active ? "Ocultar" : "Ativar"}
            pendingLabel={banner.active ? "Ocultando..." : "Ativando..."}
            icon={banner.active ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            className="min-h-10 w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 hover:border-neutral-300 hover:bg-white hover:text-black"
          />
        </form>

        <form action={deleteBannerAction}>
          <input type="hidden" name="id" value={banner.id} />
          <ConfirmButton
            message="Remover este banner? A imagem enviada não será apagada do R2/local storage."
            pendingChildren="Removendo..."
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-black text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remover
          </ConfirmButton>
        </form>
      </div>
    </article>
  );
}

function BannerThumbnail({
  alt,
  compact = false,
  label,
  ratio,
  url,
}: {
  alt: string;
  compact?: boolean;
  label: string;
  ratio: string;
  url?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-neutral-800 bg-black ${compact ? "min-h-28" : ""}`}>
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{label}</span>
      </div>
      <div className={ratio}>
        {url ? (
          <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-[10px] font-black uppercase tracking-wide text-neutral-500">
            <ImageOff className="h-5 w-5" aria-hidden="true" />
            Sem imagem
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "neutral" | "muted" | "dark" | "warning" }) {
  const classes = {
    neutral: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    muted: "border-neutral-700 bg-neutral-900 text-neutral-400",
    dark: "border-white/20 bg-white/10 text-neutral-200",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  };

  return <span className={`w-fit rounded-full border px-2 py-1 text-[10px] font-black uppercase ${classes[tone]}`}>{children}</span>;
}

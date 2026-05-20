"use client";

import { AlertTriangle, ImageIcon, Monitor, Smartphone, Upload } from "lucide-react";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { createBannerAction, updateBannerAction } from "@/app/admin/(protected)/banners/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { uploadAdminMediaFile } from "@/lib/admin-upload-client";
import type { HomeBannerSlide } from "@/lib/home-banners";
import { BANNER_UPLOAD_HELP_TEXT, directR2UploadLimitMessage, isOverDirectR2UploadLimit } from "@/lib/upload-limits";

type HomeBannerFormProps = {
  banner?: HomeBannerSlide;
  nextSortOrder: number;
  error?: string;
};

type UploadTarget = "desktop" | "mobile";

type FormState = {
  active: boolean;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  imageUrl: string;
  mobileImageUrl: string;
  alt: string;
  sortOrder: string;
};

function initialState(banner: HomeBannerSlide | undefined, nextSortOrder: number): FormState {
  return {
    active: banner?.active ?? true,
    eyebrow: banner?.eyebrow ?? "",
    title: banner?.title ?? "",
    description: banner?.description ?? "",
    ctaLabel: banner?.ctaLabel ?? "",
    href: banner?.href ?? "",
    imageUrl: banner?.imageUrl ?? "",
    mobileImageUrl: banner?.mobileImageUrl ?? "",
    alt: banner?.alt ?? "",
    sortOrder: String(banner?.sortOrder ?? nextSortOrder),
  };
}

export function HomeBannerForm({ banner, error, nextSortOrder }: HomeBannerFormProps) {
  const [state, setState] = useState(() => initialState(banner, nextSortOrder));
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const action = banner ? updateBannerAction : createBannerAction;
  const hasImage = Boolean(state.imageUrl.trim());

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function onUploadChange(target: UploadTarget, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (isOverDirectR2UploadLimit(file)) {
      setUploadError(directR2UploadLimitMessage("Imagem"));
      return;
    }

    setUploading(target);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const url = await uploadAdminMediaFile(file, {
        context: "banners",
        onProgress: (progress) => setUploadProgress(progress),
      });
      updateField(target === "desktop" ? "imageUrl" : "mobileImageUrl", url);
      if (target === "desktop" && !state.alt.trim()) {
        updateField("alt", state.title.trim() || "Banner RARE");
      }
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof Error ? uploadFailure.message : "Falha ao enviar imagem.");
    } finally {
      setUploading(null);
      setUploadProgress(null);
    }
  }

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      {banner ? <input type="hidden" name="id" value={banner.id} /> : null}
      <input type="hidden" name="imageUrl" value={state.imageUrl} />
      <input type="hidden" name="mobileImageUrl" value={state.mobileImageUrl} />

      {(error || uploadError) ? (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 xl:col-span-2" role="alert">
          {error || uploadError}
        </div>
      ) : null}

      <section className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-950/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-200">
              {banner ? "Editar banner" : "Novo banner"}
            </h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">
              Use JPG, PNG ou WEBP. Desktop recomendado: 1920x650. Mobile recomendado: 1080x1350.
            </p>
          </div>
          <label className="flex w-fit items-center gap-3 rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm font-black text-neutral-200">
            <input
              name="active"
              type="checkbox"
              checked={state.active}
              className="h-4 w-4 accent-white"
              onChange={(event) => updateField("active", event.target.checked)}
            />
            Ativo
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow">
            <input
              name="eyebrow"
              value={state.eyebrow}
              placeholder="RARE"
              className="admin-input"
              onChange={(event) => updateField("eyebrow", event.target.value)}
            />
          </Field>
          <Field label="Ordem">
            <input
              name="sortOrder"
              type="number"
              min={0}
              value={state.sortOrder}
              className="admin-input"
              onChange={(event) => updateField("sortOrder", event.target.value)}
            />
          </Field>
        </div>

        <Field label="Título">
          <input
            name="title"
            value={state.title}
            placeholder="Curadoria streetwear em drops selecionados"
            className="admin-input"
            onChange={(event) => updateField("title", event.target.value)}
          />
        </Field>

        <Field label="Descrição">
          <textarea
            name="description"
            value={state.description}
            rows={4}
            className="admin-input"
            onChange={(event) => updateField("description", event.target.value)}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="CTA label">
            <input
              name="ctaLabel"
              value={state.ctaLabel}
              placeholder="Ver curadoria"
              className="admin-input"
              onChange={(event) => updateField("ctaLabel", event.target.value)}
            />
          </Field>
          <Field label="Link interno">
            <input
              name="href"
              value={state.href}
              placeholder="/categoria/camisetas"
              className="admin-input"
              onChange={(event) => updateField("href", event.target.value)}
            />
          </Field>
        </div>

        <Field label={hasImage ? "Alt text" : "Alt text (necessário quando houver imagem)"}>
          <input
            name="alt"
            value={state.alt}
            placeholder="Banner RARE para drop selecionado"
            className="admin-input"
            onChange={(event) => updateField("alt", event.target.value)}
          />
        </Field>

        {state.active && !state.imageUrl ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-xs font-bold leading-5 text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Banner ativo sem imagem usa o placeholder premium da home.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <UploadField
            label="Imagem desktop"
            uploading={uploading === "desktop"}
            progress={uploading === "desktop" ? uploadProgress : null}
            onChange={(event) => onUploadChange("desktop", event)}
          />
          <UploadField
            label="Imagem mobile opcional"
            uploading={uploading === "mobile"}
            progress={uploading === "mobile" ? uploadProgress : null}
            onChange={(event) => onUploadChange("mobile", event)}
          />
        </div>

        <details className="rounded-lg border border-neutral-800 bg-black p-4">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-neutral-300">
            Avançado: URLs manuais
          </summary>
          <p className="mt-3 text-xs font-semibold leading-5 text-neutral-500">
            Use apenas para manutenção. O caminho principal é upload pelo Admin com R2.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="URL desktop">
              <input value={state.imageUrl} className="admin-input font-mono" onChange={(event) => updateField("imageUrl", event.target.value)} />
            </Field>
            <Field label="URL mobile">
              <input
                value={state.mobileImageUrl}
                className="admin-input font-mono"
                onChange={(event) => updateField("mobileImageUrl", event.target.value)}
              />
            </Field>
          </div>
        </details>

        <AdminSubmitButton
          idleLabel={banner ? "Salvar banner" : "Criar banner"}
          pendingLabel="Salvando..."
          className="h-12 w-full rounded-lg bg-black px-5 text-sm font-black uppercase tracking-wide text-white"
        />
      </section>

      <aside className="space-y-4">
        <BannerPreview title="Preview desktop" icon={<Monitor className="h-4 w-4" aria-hidden="true" />} ratio="aspect-[16/7]" state={state} />
        <BannerPreview title="Preview mobile" icon={<Smartphone className="h-4 w-4" aria-hidden="true" />} ratio="aspect-[9/13]" state={state} mobile />
      </aside>
    </form>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function UploadField({
  label,
  onChange,
  progress,
  uploading,
}: {
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  progress: number | null;
  uploading: boolean;
}) {
  return (
    <label className="block rounded-lg border border-neutral-800 bg-black p-4">
      <span className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-300">
        <Upload className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        className="block w-full cursor-pointer rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-semibold text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-black file:text-black hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
        onChange={onChange}
      />
      <span className="mt-2 block text-xs font-semibold text-neutral-500">
        {uploading ? (typeof progress === "number" && progress > 0 ? `Enviando... ${progress}%` : "Enviando...") : BANNER_UPLOAD_HELP_TEXT}
      </span>
    </label>
  );
}

function BannerPreview({
  icon,
  mobile = false,
  ratio,
  state,
  title,
}: {
  icon: ReactNode;
  mobile?: boolean;
  ratio: string;
  state: FormState;
  title: string;
}) {
  const previewUrl = mobile ? state.mobileImageUrl || state.imageUrl : state.imageUrl;

  return (
    <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/75 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-black px-4 py-3 text-xs font-black uppercase tracking-wide text-neutral-400">
        {icon}
        {title}
      </div>
      <div className={`relative ${ratio} overflow-hidden bg-black`}>
        {previewUrl ? (
          <img src={previewUrl} alt={state.alt || state.title || "Preview do banner"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#050505_0%,#161616_48%,#030303_100%)] text-neutral-500">
            <ImageIcon className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-[0.24em]">Placeholder RARE</span>
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.5)_48%,rgba(0,0,0,0.12)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          {state.eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">{state.eyebrow}</p> : null}
          {state.title ? (
            <p className={`${mobile ? "text-xl" : "text-2xl"} mt-2 max-w-sm font-black leading-none text-white`}>{state.title}</p>
          ) : null}
          {state.description ? <p className="mt-2 line-clamp-2 max-w-sm text-xs font-semibold leading-5 text-white/68">{state.description}</p> : null}
          {state.ctaLabel && state.href ? (
            <span className="mt-3 inline-flex min-h-9 items-center rounded-full bg-white px-4 text-[10px] font-black uppercase tracking-[0.16em] text-black">
              {state.ctaLabel}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

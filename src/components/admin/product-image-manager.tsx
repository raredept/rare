"use client";

import {
  ArrowLeft,
  ArrowRight,
  Film,
  ImageIcon,
  ImageOff,
  Loader2,
  Star,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  PRODUCT_MEDIA_LIMIT,
  classifyProductImageUrl,
  clearProductImageUrls,
  getProductMediaLabel,
  getProductMediaTypeFromUrl,
  makeProductImagePrimary,
  moveProductImageUrl,
  normalizeProductImageUrls,
  removeProductImageUrl,
  resolveProductImageUploadBatch,
  shouldReplaceProductImagesByDefault,
} from "@/lib/admin-product-images";
import { uploadAdminMediaFile } from "@/lib/admin-upload-client";
import {
  PRODUCT_UPLOAD_HELP_TEXT,
  directR2UploadLimitMessage,
  isOverDirectR2UploadLimit,
} from "@/lib/upload-limits";

type ProductImageManagerProps = {
  images: { url: string }[];
};

type UploadStatus = "uploading" | "uploaded" | "error";

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string | null;
  status: UploadStatus;
  error?: string;
  progress?: number;
  uploadedUrl?: string;
};

function createUploadId(file: File, index: number) {
  return `${Date.now()}-${index}-${file.name}`;
}

export function ProductImageManager({ images }: ProductImageManagerProps) {
  const initialUrls = useMemo(() => normalizeProductImageUrls(images.map((image) => image.url)), [images]);
  const [mediaUrls, setMediaUrls] = useState(() => initialUrls);
  const [brokenUrls, setBrokenUrls] = useState(() => new Set<string>());
  const [replaceMedia, setReplaceMedia] = useState(() => shouldReplaceProductImagesByDefault(initialUrls));
  const [manualOpen, setManualOpen] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  const uploadDisabled = replaceMedia ? false : mediaUrls.length >= PRODUCT_MEDIA_LIMIT;
  const mediaCountLabel = `${mediaUrls.length}/${PRODUCT_MEDIA_LIMIT} mídias adicionadas`;
  const coverUrl = mediaUrls[0] ?? null;

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const manualValue = useMemo(() => mediaUrls.join("\n"), [mediaUrls]);

  function markBroken(url: string) {
    setBrokenUrls((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
    setReplaceMedia(true);
  }

  async function onUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (!selectedFiles.length) return;

    const uploadableFiles = selectedFiles.filter((file) => !isOverDirectR2UploadLimit(file));
    const oversizedFiles = selectedFiles.filter((file) => isOverDirectR2UploadLimit(file));
    const replaceCurrentBatch = replaceMedia;
    const availableSlots = replaceCurrentBatch ? PRODUCT_MEDIA_LIMIT : Math.max(0, PRODUCT_MEDIA_LIMIT - mediaUrls.length);
    const filesToUpload = uploadableFiles.slice(0, availableSlots);
    const refusedFiles = uploadableFiles.slice(availableSlots);
    const uploadBatch: UploadItem[] = [
      ...filesToUpload.map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(previewUrl);
        return {
          id: createUploadId(file, index),
          name: file.name,
          previewUrl,
          status: "uploading" as const,
          progress: 0,
        };
      }),
      ...oversizedFiles.map((file, index) => ({
        id: createUploadId(file, index + filesToUpload.length),
        name: file.name,
        previewUrl: null,
        status: "error" as const,
        error: directR2UploadLimitMessage("Arquivo"),
      })),
      ...refusedFiles.map((file, index) => ({
        id: createUploadId(file, index + filesToUpload.length + oversizedFiles.length),
        name: file.name,
        previewUrl: null,
        status: "error" as const,
        error: `Limite de ${PRODUCT_MEDIA_LIMIT} mídias atingido.`,
      })),
    ];

    setUploadItems((current) => [...uploadBatch, ...current].slice(0, 24));

    const uploadedUrls: string[] = [];
    for (const [fileIndex, file] of filesToUpload.entries()) {
      const itemId = uploadBatch[fileIndex]?.id;
      if (!itemId) continue;

      try {
        const uploadedUrl = await uploadAdminMediaFile(file, {
          context: "products",
          onProgress: (progress) => {
            setUploadItems((current) => current.map((item) => (item.id === itemId ? { ...item, progress } : item)));
          },
        });
        uploadedUrls.push(uploadedUrl);
        setUploadItems((current) =>
          current.map((item) => (item.id === itemId ? { ...item, status: "uploaded", progress: 100, uploadedUrl } : item)),
        );
        setMediaUrls((current) => {
          return resolveProductImageUploadBatch({
            currentImageUrls: current,
            uploadedUrls: replaceCurrentBatch ? uploadedUrls : [uploadedUrl],
            replaceImages: replaceCurrentBatch,
          });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao enviar mídia.";
        setUploadItems((current) =>
          current.map((item) => (item.id === itemId ? { ...item, status: "error", error: message } : item)),
        );
      }
    }

    if (replaceCurrentBatch && uploadedUrls.length) {
      setReplaceMedia(false);
    }
  }

  return (
    <section className="space-y-5 rounded-lg border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <input type="hidden" name="imageUrls" value={mediaUrls.join("\n")} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-neutral-200">Mídia do produto</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">
            Adicione imagens, GIFs ou vídeos curtos. A primeira mídia será usada como capa do produto.
          </p>
        </div>
        <span className="w-fit rounded-full border border-neutral-700 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-wide text-neutral-300">
          {mediaCountLabel}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
          <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Capa atual</span>
            {coverUrl ? <MediaBadge>CAPA</MediaBadge> : null}
          </div>
          <div className="aspect-[4/3] max-h-[380px]">
            {coverUrl ? (
              <MediaPreview
                alt="Capa do produto"
                broken={brokenUrls.has(coverUrl)}
                className="h-full w-full object-cover"
                onBroken={() => markBroken(coverUrl)}
                url={coverUrl}
                controls
              />
            ) : (
              <MediaPlaceholder label="Nenhuma mídia principal" />
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-neutral-800 bg-black p-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-300">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Adicionar mídia
            </span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
              disabled={uploadDisabled}
              className="block w-full cursor-pointer rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-semibold text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-black file:text-black hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-45"
              aria-describedby="product-media-help"
              onChange={onUploadChange}
            />
          </label>
          <p id="product-media-help" className="text-xs font-semibold leading-5 text-neutral-500">
            {PRODUCT_UPLOAD_HELP_TEXT}
          </p>
          <label className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm font-black text-neutral-200">
            <input
              name="replaceImages"
              type="checkbox"
              checked={replaceMedia}
              className="mt-0.5 h-4 w-4 accent-white"
              onChange={(event) => setReplaceMedia(event.target.checked)}
            />
            <span>
              Substituir mídias antigas por este upload
              <span className="mt-1 block text-xs font-semibold leading-5 text-neutral-500">
                Use para trocar links antigos locais, seed ou quebrados por uploads novos em R2.
              </span>
            </span>
          </label>
        </div>
      </div>

      {uploadItems.length ? (
        <div className="space-y-2 rounded-lg border border-neutral-800 bg-black p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Fila de upload</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {uploadItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-neutral-800 bg-black">
                  {item.previewUrl ? (
                    <MediaPreview alt="" broken={false} className="h-full w-full object-cover" onBroken={() => undefined} url={item.previewUrl} />
                  ) : (
                    <MediaPlaceholder label="Sem preview" compact />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-neutral-200">{item.name}</p>
                  {item.status === "uploading" ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-neutral-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      {typeof item.progress === "number" && item.progress > 0 ? `Enviando... ${item.progress}%` : "Enviando..."}
                    </p>
                  ) : null}
                  {item.status === "uploaded" ? <p className="mt-1 text-xs font-bold text-emerald-200">Upload concluído.</p> : null}
                  {item.status === "error" ? <p className="mt-1 text-xs font-bold text-red-200">{item.error}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-black uppercase tracking-wide text-neutral-400">Galeria</h3>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={() => setMediaUrls(clearProductImageUrls())}
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Limpar mídias antigas
          </button>
        </div>

        {mediaUrls.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mediaUrls.map((url, index) => {
              const broken = brokenUrls.has(url);
              const source = classifyProductImageUrl(url);
              const mediaType = getProductMediaTypeFromUrl(url);
              const mediaLabel = getProductMediaLabel(mediaType);

              return (
                <article
                  key={url}
                  className="admin-media-card overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/70 transition hover:border-neutral-600 hover:bg-neutral-900"
                >
                  <div className="relative aspect-[4/3] bg-black">
                    <MediaPreview
                      alt={`Mídia ${index + 1}`}
                      broken={broken}
                      className="h-full w-full object-cover"
                      onBroken={() => markBroken(url)}
                      url={url}
                    />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {index === 0 ? <MediaBadge tone="strong">CAPA</MediaBadge> : null}
                      <MediaBadge>{mediaLabel}</MediaBadge>
                    </div>
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-neutral-200">Mídia {index + 1}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <MediaBadge>{source}</MediaBadge>
                          {broken ? <MediaBadge tone="danger">Quebrada</MediaBadge> : null}
                        </div>
                      </div>
                      <MediaTypeIcon type={mediaType} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={index === 0}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-2 py-1.5 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => setMediaUrls((current) => moveProductImageUrl(current, url, "left"))}
                        aria-label={`Mover mídia ${index + 1} para a esquerda`}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Mover
                      </button>
                      <button
                        type="button"
                        disabled={index === mediaUrls.length - 1}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-2 py-1.5 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => setMediaUrls((current) => moveProductImageUrl(current, url, "right"))}
                        aria-label={`Mover mídia ${index + 1} para a direita`}
                      >
                        Mover
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {index > 0 ? (
                        <button
                          type="button"
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-black text-neutral-200 transition hover:border-neutral-300 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                          onClick={() => setMediaUrls((current) => makeProductImagePrimary(current, url))}
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                          Definir capa
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                        onClick={() => setMediaUrls((current) => removeProductImageUrl(current, url))}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remover
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-700 bg-black px-4 py-8 text-center">
            <p className="text-sm font-black text-neutral-300">Nenhuma mídia adicionada.</p>
            <p className="mt-2 text-xs font-semibold text-neutral-500">Adicione uma imagem principal para melhorar a vitrine.</p>
          </div>
        )}
      </div>

      <details
        className="rounded-lg border border-neutral-800 bg-black p-4"
        open={manualOpen}
        onToggle={(event) => setManualOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-neutral-300">
          Avançado: URLs manuais
        </summary>
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100">
          Use apenas para manutenção técnica. Para produção, prefira upload via R2.
        </p>
        <textarea
          value={manualValue}
          rows={5}
          className="admin-input mt-3 font-mono"
          onChange={(event) => setMediaUrls(normalizeProductImageUrls(event.target.value.split(/\r?\n/)))}
        />
        <p className="mt-2 text-xs font-semibold text-neutral-500">
          As URLs acima podem ser copiadas ou editadas manualmente, mas não são o caminho principal do cadastro.
        </p>
      </details>
    </section>
  );
}

function MediaBadge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "danger" | "strong" }) {
  const toneClass = {
    danger: "border-red-400/30 bg-red-500/10 text-red-200",
    neutral: "border-neutral-700 bg-neutral-950 text-neutral-300",
    strong: "border-white bg-white text-black",
  }[tone];

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${toneClass}`}>{children}</span>;
}

function MediaTypeIcon({ type }: { type: ReturnType<typeof getProductMediaTypeFromUrl> }) {
  const className = "h-4 w-4 text-neutral-500";
  if (type === "video") return <Film className={className} aria-hidden="true" />;
  return <ImageIcon className={className} aria-hidden="true" />;
}

function MediaPreview({
  alt,
  broken,
  className,
  controls = false,
  onBroken,
  url,
}: {
  alt: string;
  broken: boolean;
  className: string;
  controls?: boolean;
  onBroken: () => void;
  url: string;
}) {
  if (broken) {
    return <MediaPlaceholder label="Imagem indisponível" />;
  }

  const type = getProductMediaTypeFromUrl(url);

  if (type === "video") {
    return (
      <video
        src={url}
        aria-label={alt}
        className={className}
        controls={controls}
        muted
        playsInline
        preload="metadata"
        onError={onBroken}
      />
    );
  }

  return <img src={url} alt={alt} className={className} onError={onBroken} />;
}

function MediaPlaceholder({ compact = false, label }: { compact?: boolean; label: string }) {
  return (
    <div className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-2 bg-black px-3 text-center text-xs font-black uppercase tracking-wide text-neutral-500">
      <ImageOff className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
      {label}
    </div>
  );
}

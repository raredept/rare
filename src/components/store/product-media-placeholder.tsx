type ProductMediaPlaceholderProps = {
  compact?: boolean;
  label?: string;
  className?: string;
};

export function ProductMediaPlaceholder({
  compact = false,
  label = "Sem imagem",
  className = "",
}: ProductMediaPlaceholderProps) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center border border-white/10 bg-neutral-950 p-4 text-center text-white ${className}`}
    >
      <span className={compact ? "text-sm font-black tracking-[0.2em]" : "text-3xl font-black tracking-[0.22em]"}>
        RARE
      </span>
      <span className={compact ? "mt-2 h-px w-8 bg-white/25" : "mt-4 h-px w-14 bg-white/25"} />
      <span
        className={
          compact
            ? "mt-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/55"
            : "mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-white/55"
        }
      >
        {label}
      </span>
    </div>
  );
}

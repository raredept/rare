import type { ReactNode } from "react";

export function CustomerAuthShell({
  eyebrow,
  title,
  description,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`store-shell py-10 sm:py-14 lg:py-16 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white lg:grid lg:grid-cols-[0.72fr_1fr]">
        <aside className="flex min-h-44 flex-col justify-between bg-black p-7 text-white sm:p-9 lg:min-h-full">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/45">Rare Dept.</p>
          <div className="mt-12">
            <p className="max-w-xs text-2xl font-black leading-tight tracking-tight sm:text-3xl">Sua curadoria, seus dados, seus pedidos.</p>
            <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/55">Uma conta simples para acompanhar sua relação com a RARE.</p>
          </div>
        </aside>
        <section className="p-6 sm:p-9 lg:p-10">
          <p className="store-section-label">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-neutral-500">{description}</p>
          {children}
        </section>
      </div>
    </div>
  );
}

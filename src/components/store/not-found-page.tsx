import Link from "next/link";

type StoreNotFoundPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: {
    href: string;
    label: string;
  };
  secondaryAction: {
    href: string;
    label: string;
  };
};

export function StoreNotFoundPage({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
}: StoreNotFoundPageProps) {
  return (
    <section className="mx-auto flex min-h-[58vh] max-w-[1440px] items-center px-4 py-14 sm:px-6 lg:px-8 xl:px-10">
      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-600">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-neutral-600 sm:text-base">{description}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={primaryAction.href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            {primaryAction.label}
          </Link>
          <Link
            href={secondaryAction.href}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-5 text-xs font-black uppercase tracking-[0.16em] text-neutral-800 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            {secondaryAction.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

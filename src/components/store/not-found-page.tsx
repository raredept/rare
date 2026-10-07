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
    <section className="store-shell flex min-h-[58vh] items-center py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="store-section-label">{eyebrow}</p>
        <h1 className="mt-5 text-4xl font-medium tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">{description}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={primaryAction.href}
            className="store-button-primary"
          >
            {primaryAction.label}
          </Link>
          <Link
            href={secondaryAction.href}
            className="store-button-secondary"
          >
            {secondaryAction.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

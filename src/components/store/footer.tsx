import Link from "next/link";
import { AtSign, MessageCircle } from "lucide-react";
import { virtualCatalogCategories } from "@/lib/catalog-categories";
import { buildStorefrontCommerceState, type StorefrontCommerceState } from "@/lib/storefront-commerce";
import { getInstagramUrl } from "@/lib/store-social";

type FooterCategory = {
  id: string;
  name: string;
  slug: string;
};

type StoreFooterProps = {
  categories: FooterCategory[];
  whatsappNumber?: string | null;
  instagramUrl?: string | null;
  commerce?: StorefrontCommerceState;
};

const baseServiceLinks = [
  { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
  { href: "/minha-conta", label: "Minha conta" },
  { href: "/minha-conta/pedidos", label: "Meus pedidos" },
];

const institutionalLinks = [
  { href: "/sobre", label: "Sobre a RARE" },
  { href: "/contato", label: "Contato" },
  { href: "/politica-de-envio", label: "Política de envio" },
  { href: "/privacidade-e-termos", label: "Privacidade e termos" },
];

const footerLinkClass =
  "inline-flex min-h-11 items-center text-sm font-normal text-white/70 transition-colors duration-150 hover:text-white hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function FooterNavList({
  label,
  links,
}: {
  label: string;
  links: { href: string; label: string; id?: string }[];
}) {
  return (
    <nav aria-label={label}>
      <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/60">{label}</h2>
      <ul className="mt-4 grid gap-1">
        {links.map((link) => (
          <li key={link.id ?? link.href}>
            <Link href={link.href} className={footerLinkClass}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StoreFooter({ categories, whatsappNumber, instagramUrl, commerce }: StoreFooterProps) {
  const commerceState = commerce ?? buildStorefrontCommerceState(true);
  const year = new Date().getFullYear();
  const categoryLinks = [
    ...virtualCatalogCategories.map((category) => ({
      id: category.slug,
      href: `/categoria/${category.slug}`,
      label: category.name === "Destaque" ? "Destaques" : category.name,
    })),
    ...categories.slice(0, 6).map((category) => ({
      id: category.id,
      href: `/categoria/${category.slug}`,
      label: category.name,
    })),
  ];
  const whatsappDigits = whatsappNumber?.replace(/\D/g, "");
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}`
    : "https://wa.me/?text=Olá%2C%20quero%20falar%20com%20a%20RARE.";
  const serviceLinks = commerceState.checkoutEnabled
    ? [...baseServiceLinks, { href: "/finalizar-compra", label: "Finalizar compra" }]
    : baseServiceLinks;

  return (
    <footer className="store-footer border-t border-white/15 bg-black text-neutral-100">
      <div className="store-shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12 lg:py-20">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex min-h-11 items-center text-4xl font-medium tracking-[0.08em] transition-colors duration-150 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            RARE
          </Link>
          <p className="mt-5 max-w-sm text-sm font-normal leading-7 text-white/70">
            A RARE reúne peças importadas, drops limitados e uma seleção feita para quem não quer se vestir igual a todo mundo.
          </p>
          <div className="mt-4 max-w-sm text-sm font-normal leading-7 text-white/70">
            <p>Atendimento direto para dúvidas sobre peças, disponibilidade e pedidos.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
            <a href={getInstagramUrl(instagramUrl)} target="_blank" rel="noopener noreferrer" className={`${footerLinkClass} gap-2`}>
              <AtSign className="h-4 w-4" aria-hidden="true" />
              Instagram
            </a>
            {whatsappDigits ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={`${footerLinkClass} gap-2`}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a> : null}
          </div>
        </div>

        <FooterNavList label="Categorias" links={categoryLinks} />
        <FooterNavList label="Atendimento" links={serviceLinks} />
        <FooterNavList label="Institucional" links={institutionalLinks} />
      </div>

      <div className="border-t border-white/10">
        <div className="store-shell flex flex-col gap-3 py-6 text-xs font-normal leading-6 text-white/65 lg:flex-row lg:items-center lg:justify-between">
          <p>© {year} RARE</p>
          <p>{commerceState.checkoutEnabled ? "Pagamento e envio confirmados durante o checkout." : "Catálogo disponível · compras temporariamente pausadas."}</p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { AtSign, MessageCircle } from "lucide-react";
import { virtualCatalogCategories } from "@/lib/catalog-categories";

type FooterCategory = {
  id: string;
  name: string;
  slug: string;
};

type StoreFooterProps = {
  categories: FooterCategory[];
  whatsappNumber?: string | null;
};

const serviceLinks = [
  { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
  { href: "/minha-conta", label: "Minha conta" },
  { href: "/minha-conta/pedidos", label: "Meus pedidos" },
  { href: "/finalizar-compra", label: "Finalizar compra" },
];

const institutionalLinks = [
  { href: "/sobre", label: "Sobre a RARE" },
  { href: "/contato", label: "Contato" },
  { href: "/politica-de-envio", label: "Política de envio" },
  { href: "/privacidade-e-termos", label: "Privacidade e termos" },
];

const footerLinkClass =
  "inline-flex min-h-11 items-center text-sm font-bold text-white/70 transition-[color,transform] duration-150 hover:-translate-y-px hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:translate-y-0";

function FooterNavList({
  label,
  links,
}: {
  label: string;
  links: { href: string; label: string; id?: string }[];
}) {
  return (
    <nav aria-label={label}>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">{label}</p>
      <div className="mt-4 grid gap-1">
        {links.map((link) => (
          <Link key={link.id ?? link.href} href={link.href} className={footerLinkClass}>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function StoreFooter({ categories, whatsappNumber }: StoreFooterProps) {
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

  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr] lg:px-8 lg:py-12 xl:px-10">
        <div>
          <Link href="/" className="inline-flex text-2xl font-black tracking-[0.2em] transition hover:text-white/80">
            RARE
          </Link>
          <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-white/60">
            A RARE reúne peças importadas, drops limitados e uma seleção feita para quem não quer se vestir igual a todo mundo.
          </p>
          <div className="mt-6 grid gap-2 text-sm font-bold text-white/70">
            <a href="mailto:suporte@raredept.com.br" className={footerLinkClass}>
              suporte@raredept.com.br
            </a>
            <p>Atendimento direto para dúvidas, pedidos e pós-compra.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="https://www.instagram.com/raredept/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-black text-white transition hover:border-white hover:bg-white hover:text-black">
              <AtSign className="h-4 w-4" aria-hidden="true" />
              Instagram
            </a>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-black text-white transition hover:border-white hover:bg-white hover:text-black">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          </div>
        </div>

        <FooterNavList label="Categorias" links={categoryLinks} />
        <FooterNavList label="Atendimento" links={serviceLinks} />
        <FooterNavList label="Institucional" links={institutionalLinks} />
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-5 text-xs font-bold uppercase tracking-[0.16em] text-white/45 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10">
          <p>© {year} RARE</p>
          <p>Pagamento via Pix ou cartão disponível no checkout. Envio para todo o Brasil.</p>
        </div>
      </div>
    </footer>
  );
}

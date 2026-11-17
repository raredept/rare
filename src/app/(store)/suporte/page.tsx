import { randomUUID } from "node:crypto";
import { AtSign, MessageCircle } from "lucide-react";
import { SupportForm } from "@/components/store/support-form";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";
import { getInstagramUrl } from "@/lib/store-social";
import { isSupportCategory, SUPPORT_CATEGORY_LABELS } from "@/lib/support-request-contract";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Suporte",
  description: "Fale com a RARE sobre peças, pedidos, pagamento, entrega, trocas e devoluções.",
  path: "/suporte",
});

type SupportPageProps = {
  searchParams: Promise<{ produto?: string | string[]; categoria?: string | string[] }>;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const params = await searchParams;
  const productSlug = typeof params.produto === "string" && params.produto.length <= 120 && SLUG_PATTERN.test(params.produto) ? params.produto : null;
  const [customer, settings] = await Promise.all([getCurrentCustomer(), import("@/lib/settings").then(({ getStoreSettings }) => getStoreSettings())]);
  // The product shown and sent is the catalog's, resolved here; the query string is only a hint.
  const product = productSlug ? await prisma.product.findUnique({ where: { slug: productSlug }, select: { slug: true, title: true } }) : null;
  const orders = customer
    ? await prisma.order.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, orderNumber: true, createdAt: true },
      })
    : [];
  const category = typeof params.categoria === "string" && isSupportCategory(params.categoria) ? params.categoria : product ? "PRODUCT_QUESTION" : undefined;
  const whatsappDigits = settings.whatsappNumber?.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <section className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Atendimento</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">Suporte RARE</h1>
        <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-neutral-600">
          Você recebe um protocolo e a resposta chega no seu e-mail.
        </p>
        {/* UIUX-SUPPORT-001: subject shortcuts pre-select the subject (the ?categoria= the form already reads). */}
        <nav aria-label="Assuntos frequentes" className="mt-6 flex flex-wrap gap-2">
          {(["ORDER", "SHIPPING", "RETURN", "PAYMENT", "PRODUCT_QUESTION"] as const).map((value) => (
            <Link
              key={value}
              href={`/suporte?categoria=${value}${product ? `&produto=${encodeURIComponent(product.slug)}` : ""}`}
              aria-current={category === value ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-black uppercase tracking-[0.12em] ${category === value ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950"}`}
            >
              {SUPPORT_CATEGORY_LABELS[value]}
            </Link>
          ))}
        </nav>
      </section>

      <section aria-label="Formulário de suporte" className="mt-8 rounded-lg border border-neutral-200 bg-white p-5 sm:p-8">
        <SupportForm
          key={category ?? "none"}
          signedIn={Boolean(customer)}
          submissionKey={randomUUID()}
          defaultName={customer?.name}
          defaultEmail={customer?.email}
          defaultCategory={category}
          product={product}
          orders={orders.map((order) => ({ id: order.id, label: `${order.orderNumber} · ${order.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` }))}
        />
      </section>

      <section aria-labelledby="support-channels" className="mt-8 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 id="support-channels" className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">Prefere conversar?</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={getInstagramUrl(settings.instagramUrl)} target="_blank" rel="noopener noreferrer" className="store-button-secondary gap-2"><AtSign className="h-4 w-4" aria-hidden="true" /> Instagram</a>
          {whatsappDigits ? <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="store-button-secondary gap-2"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</a> : null}
        </div>
      </section>
    </div>
  );
}

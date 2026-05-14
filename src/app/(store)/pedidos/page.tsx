import Link from "next/link";

export default function CustomerOrdersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
      <h1 className="text-3xl font-black text-neutral-950">Pedidos</h1>
      <p className="mt-4 text-neutral-600">
        Acompanhe a confirmação pelo e-mail informado no Stripe Checkout. Para suporte, fale com a RARE pelo WhatsApp
        do produto ou pelo atendimento cadastrado.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
      >
        Continuar comprando
      </Link>
    </div>
  );
}

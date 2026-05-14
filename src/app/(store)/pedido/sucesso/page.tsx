import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/store/clear-cart-on-success";

export default function OrderSuccessPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8">
      <ClearCartOnSuccess />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-success">Checkout iniciado</p>
      <h1 className="mt-3 text-3xl font-black text-neutral-950">Pedido recebido pela RARE</h1>
      <p className="mt-4 text-neutral-600">
        Se o pagamento foi confirmado, a Stripe avisará a loja pelo webhook e o pedido aparecerá como pago no admin.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white"
      >
        Voltar para a loja
      </Link>
    </div>
  );
}

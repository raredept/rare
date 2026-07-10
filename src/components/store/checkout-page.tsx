import Link from "next/link";
import { CartPageClient } from "@/components/store/cart-page-client";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { FIRST_ORDER_COUPON_CODE, FIRST_ORDER_COUPON_PERCENT, paidOrderStatuses } from "@/lib/coupons";
import { isValidCpf, maskCpf } from "@/lib/cpf";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import { getEffectiveFixedShippingInCents, getEffectiveFreeShippingThresholdInCents, getShippingPublicConfig } from "@/lib/shipping";

type StoreCheckoutPageProps = {
  searchParams: Promise<{ address?: string }>;
};

export async function StoreCheckoutPage({ searchParams }: StoreCheckoutPageProps) {
  const [{ address }, settings, customer] = await Promise.all([searchParams, getStoreSettings(), getCurrentCustomer()]);

  if (!customer) {
    return <CheckoutLoginRequired />;
  }

  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      recipientName: true,
      phone: true,
      cep: true,
      street: true,
      number: true,
      complement: true,
      neighborhood: true,
      city: true,
      state: true,
      isDefault: true,
    },
  });
  const selectedAddressId = address && addresses.some((item) => item.id === address) ? address : addresses[0]?.id ?? "";
  const paidOrderCount = await prisma.order.count({
    where: {
      customerId: customer.id,
      status: { in: [...paidOrderStatuses] },
    },
  });

  return (
    <CartPageClient
      customer={{
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        hasCpf: isValidCpf(customer.cpf),
        cpfMasked: maskCpf(customer.cpf),
      }}
      addresses={addresses}
      initialSelectedAddressId={selectedAddressId}
      shippingSettings={{
        shippingMode: settings.shippingMode,
        manualShippingInCents: settings.manualShippingInCents,
        fixedShippingInCents: getEffectiveFixedShippingInCents(settings),
        freeShippingMinInCents: settings.freeShippingMinInCents,
        freeShippingThresholdInCents: getEffectiveFreeShippingThresholdInCents(settings),
        checkoutRequiresAddress: settings.checkoutRequiresAddress,
        shippingInstructions: settings.shippingInstructions,
      }}
      shippingConfig={getShippingPublicConfig(settings)}
      welcomeCoupon={
        paidOrderCount === 0
          ? { code: FIRST_ORDER_COUPON_CODE, percentOff: FIRST_ORDER_COUPON_PERCENT }
          : null
      }
    />
  );
}

function CheckoutLoginRequired() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8">
      <section className="mx-auto max-w-xl rounded-lg border border-neutral-200 bg-white px-6 py-12">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Finalizar compra</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">Para finalizar sua compra, entre ou crie sua conta.</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-neutral-500">
          Seu carrinho fica salvo neste navegador enquanto você acessa sua conta.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/entrar?next=%2Ffinalizar-compra"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-6 text-sm font-black uppercase tracking-wide text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro?next=%2Ffinalizar-compra"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-neutral-300 px-6 text-sm font-black uppercase tracking-wide text-neutral-950 transition hover:border-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950"
          >
            Criar conta
          </Link>
        </div>
      </section>
    </div>
  );
}

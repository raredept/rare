import { CartPageClient } from "@/components/store/cart-page-client";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import { getEffectiveFixedShippingInCents, getEffectiveFreeShippingThresholdInCents, getShippingPublicConfig } from "@/lib/shipping";

type StoreCheckoutPageProps = {
  searchParams: Promise<{ address?: string }>;
};

export async function StoreCheckoutPage({ searchParams }: StoreCheckoutPageProps) {
  const [{ address }, settings, customer] = await Promise.all([searchParams, getStoreSettings(), getCurrentCustomer()]);
  const addresses = customer
    ? await prisma.customerAddress.findMany({
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
      })
    : [];
  const selectedAddressId = address && addresses.some((item) => item.id === address) ? address : addresses[0]?.id ?? "";

  return (
    <CartPageClient
      customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null}
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
    />
  );
}

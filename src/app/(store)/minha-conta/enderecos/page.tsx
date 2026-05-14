import { AccountShell } from "@/components/store/account-shell";
import { CustomerAddresses } from "@/components/store/customer-addresses";
import { requireCustomer } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AddressesPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function CustomerAddressesPage({ searchParams }: AddressesPageProps) {
  const [customer, params] = await Promise.all([requireCustomer("/minha-conta/enderecos"), searchParams]);
  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
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

  return (
    <AccountShell title="Endereços" subtitle="Cadastre endereços de entrega. Frete real e rastreio entram em fase futura.">
      <CustomerAddresses addresses={addresses} pageError={params.error} />
    </AccountShell>
  );
}

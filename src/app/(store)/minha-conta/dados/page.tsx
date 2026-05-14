import { AccountShell } from "@/components/store/account-shell";
import { CustomerProfileForm } from "@/components/store/customer-profile-form";
import { requireCustomer } from "@/lib/customer-auth";
import { toCustomerProfileView } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export default async function CustomerDataPage() {
  const customer = await requireCustomer("/minha-conta/dados");

  return (
    <AccountShell title="Dados pessoais" subtitle="Mantenha seus dados básicos atualizados. O e-mail fica bloqueado nesta fase.">
      <CustomerProfileForm customer={toCustomerProfileView(customer)} />
    </AccountShell>
  );
}

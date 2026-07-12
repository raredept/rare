import { redirect } from "next/navigation";
import { CustomerRegisterForm } from "@/components/store/customer-auth-forms";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { buildNoIndexMetadata } from "@/lib/seo";
import { CustomerAuthShell } from "@/components/store/customer-auth-shell";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";

export const dynamic = "force-dynamic";

export const metadata = buildNoIndexMetadata({
  title: "Criar cadastro | RARE",
  description: "Crie sua conta RARE para organizar seus dados e acompanhar pedidos.",
  path: "/cadastro",
});

type RegisterPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const [{ next }, customer] = await Promise.all([searchParams, getCurrentCustomer()]);

  if (customer) {
    redirect("/minha-conta");
  }
  const commerce = getStorefrontCommerceState();

  return (
    <CustomerAuthShell wide eyebrow="Conta RARE" title="Criar cadastro" description={commerce.checkoutEnabled ? "Informe seus dados para concluir pedidos e acompanhar cada etapa. O CPF é necessário para emissão e envio." : "Crie sua conta para organizar dados, endereços e acompanhar pedidos anteriores. As compras estão temporariamente pausadas."}>
      <CustomerRegisterForm next={next} />
    </CustomerAuthShell>
  );
}

import { redirect } from "next/navigation";
import { CustomerLoginForm } from "@/components/store/customer-auth-forms";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { buildNoIndexMetadata } from "@/lib/seo";
import { CustomerAuthShell } from "@/components/store/customer-auth-shell";

export const dynamic = "force-dynamic";

export const metadata = buildNoIndexMetadata({
  title: "Entrar | RARE",
  description: "Acesse sua conta RARE com segurança para acompanhar pedidos.",
  path: "/entrar",
});

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next }, customer] = await Promise.all([searchParams, getCurrentCustomer()]);

  if (customer) {
    redirect("/minha-conta");
  }

  return (
    <CustomerAuthShell eyebrow="Conta RARE" title="Entrar" description="Acesse seus dados, endereços e pedidos em um só lugar.">
      <CustomerLoginForm next={next} />
    </CustomerAuthShell>
  );
}

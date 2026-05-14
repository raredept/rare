import { redirect } from "next/navigation";
import { CustomerLoginForm } from "@/components/store/customer-auth-forms";
import { getCurrentCustomer } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ next }, customer] = await Promise.all([searchParams, getCurrentCustomer()]);

  if (customer) {
    redirect("/minha-conta");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Conta RARE</p>
      <h1 className="mt-2 text-3xl font-black text-neutral-950">Entrar</h1>
      <p className="mt-3 text-sm font-medium text-neutral-500">Acesse seus dados, endereços e pedidos com segurança.</p>
      <CustomerLoginForm next={next} />
    </div>
  );
}

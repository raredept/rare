import { LoginForm } from "@/app/admin/login/login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">RARE</p>
        <h1 className="mt-3 text-2xl font-black text-neutral-950">Acesso admin</h1>
        <p className="mt-2 text-sm text-neutral-500">Entre para gerenciar produtos, estoque, pedidos e configurações.</p>
        <LoginForm next={next} />
      </section>
    </main>
  );
}

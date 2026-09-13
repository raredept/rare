import { LoginForm } from "@/app/admin/login/login-form";
import { getLoginBanner } from "@/lib/home-banners";
import { LoginBannerPanel } from "@/components/store/login-banner-panel";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const banner = await getLoginBanner("admin_login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm lg:grid-cols-2">
      <LoginBannerPanel banner={banner} />
      <section className="p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-500">RARE</p>
        <h1 className="mt-3 text-2xl font-black text-neutral-950">Acesso admin</h1>
        <p className="mt-2 text-sm text-neutral-500">Entre para gerenciar produtos, estoque, pedidos e configurações.</p>
        <LoginForm next={next} />
      </section>
      </div>
    </main>
  );
}

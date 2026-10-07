import { createRoot } from "react-dom/client";
import { useEffect, useState, type ReactNode } from "react";
import { installNetworkGuard } from "./network-guard";
import { usePathname, useSearchParams } from "./mocks/navigation";
import { fixtureCategories, fixtureCustomer, fixtureSettings } from "./fixtures";
import { CartProvider } from "@/components/store/cart-context";
import { CartDrawer } from "@/components/store/cart-drawer";
import { StoreHeader } from "@/components/store/header";
import { StoreFooter } from "@/components/store/footer";
import { AccountShell } from "@/components/store/account-shell";
import { CartPageClient } from "@/components/store/cart-page-client";
import { CustomerProfileForm } from "@/components/store/customer-profile-form";
import { StoreNotFoundPage } from "@/components/store/not-found-page";
import { getStorefrontCommerceState } from "@/lib/storefront-commerce";
import "../../src/app/globals.css";
import "./preview.css";

installNetworkGuard();

async function routeContent(pathname: string, query: Record<string, string>): Promise<ReactNode> {
  if (pathname === "/") return (await import("@/app/(store)/page")).default({ searchParams: Promise.resolve(query) });
  if (pathname.startsWith("/categoria/")) return (await import("@/app/(store)/categoria/[slug]/page")).default({ params: Promise.resolve({ slug: decodeURIComponent(pathname.slice(11)) }), searchParams: Promise.resolve(query) });
  if (pathname.startsWith("/produto/")) return (await import("@/app/(store)/produto/[slug]/page")).default({ params: Promise.resolve({ slug: decodeURIComponent(pathname.slice(9)) }) });
  if (pathname === "/finalizar-compra" || pathname === "/cart") return (await import("@/components/store/checkout-page")).StoreCheckoutPage({ searchParams: Promise.resolve(query) });
  if (pathname === "/qa/cart") return <CartPageClient customer={{ ...fixtureCustomer, hasCpf: false, cpfMasked: "" }} addresses={[]} initialSelectedAddressId="" shippingSettings={{ shippingMode: "disabled", checkoutRequiresAddress: false }} shippingConfig={{ enabled: false, mode: "disabled", provider: "manual", originCepConfigured: false }} />;
  if (pathname === "/entrar") return (await import("@/app/(store)/entrar/page")).default({ searchParams: Promise.resolve(query) });
  if (pathname === "/cadastro") return (await import("@/app/(store)/cadastro/page")).default({ searchParams: Promise.resolve(query) });
  if (pathname === "/contato") return (await import("@/app/(store)/contato/page")).default();
  if (pathname === "/sobre") return (await import("@/app/(store)/sobre/page")).default();
  if (pathname === "/trocas-e-devolucoes") return (await import("@/app/(store)/trocas-e-devolucoes/page")).default();
  if (pathname === "/politica-de-envio") return (await import("@/app/(store)/politica-de-envio/page")).default();
  if (pathname === "/privacidade-e-termos") return (await import("@/app/(store)/privacidade-e-termos/page")).default();
  if (pathname === "/pedidos") return (await import("@/app/(store)/pedidos/page")).default();
  if (pathname === "/minha-conta" || pathname === "/minha-conta/dados") return <AccountShell title="Dados pessoais" subtitle="Perfil sintético de Fixture QA — sem sessão ou persistência."><CustomerProfileForm customer={{ ...fixtureCustomer, cpfMasked: "" }} /></AccountShell>;
  if (pathname === "/minha-conta/pedidos") return <AccountShell title="Meus pedidos" subtitle="Fixture QA — nenhuma consulta de pedidos reais."><p className="p-6">Nenhum pedido nesta fixture local.</p></AccountShell>;
  if (pathname === "/minha-conta/enderecos") return <AccountShell title="Meus endereços" subtitle="Fixture QA — nenhuma consulta ou gravação de endereços."><p className="p-6">Nenhum endereço nesta fixture local.</p></AccountShell>;
  return missingPage(pathname);
}

function missingPage(pathname: string) {
  return <StoreNotFoundPage eyebrow="Fixture QA" title={pathname.startsWith("/produto/") ? "Produto não encontrado" : "Página não encontrada"} description="Esta rota não consta do preview local de fixtures." primaryAction={{ href: "/categoria/tudo", label: "Ver catálogo" }} secondaryAction={{ href: "/", label: "Voltar ao início" }} />;
}

function Preview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [content, setContent] = useState<ReactNode>(null);
  const [header, setHeader] = useState<ReactNode>(null);
  const [readyRoute, setReadyRoute] = useState("");
  const [failure, setFailure] = useState(false);
  const commerce = getStorefrontCommerceState();

  useEffect(() => {
    let cancelled = false;
    Promise.all([StoreHeader({ categories: fixtureCategories }), routeContent(pathname, Object.fromEntries(new URLSearchParams(routeKey.split("?").slice(1).join("?"))))]).then(([nextHeader, nextContent]) => {
      if (cancelled) return;
      setHeader(nextHeader); setContent(nextContent); setReadyRoute(routeKey); setFailure(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof Error && error.message === "RARE_FIXTURE_NOT_FOUND") { setContent(missingPage(pathname)); setReadyRoute(routeKey); return; }
      if (error instanceof Error && error.message === "RARE_FIXTURE_REDIRECT") return;
      setFailure(true); setReadyRoute(routeKey);
      // No application data, request bodies or environment values are emitted.
      console.error("Fixture QA refused an unsupported import or operation.");
    });
    return () => { cancelled = true; };
  }, [pathname, routeKey]);

  return <CartProvider><div className="storefront-motion-root flex min-h-screen flex-col" data-fixture-qa="true" data-fixture-ready={readyRoute === routeKey ? "true" : "false"}>
      <a href="#store-main" tabIndex={0} className="store-skip-link">Pular para o conteúdo</a>
    {header}
    <aside className="fixture-qa-label" aria-label="Status da validação local">LOCAL FIXTURE QA — catálogo sintético; sem backend, pagamentos, frete, e-mail ou sessão real.</aside>
    <CartDrawer commerce={commerce} />
    <main id="store-main" tabIndex={-1} className="flex-1">{readyRoute === routeKey ? failure ? <section className="store-shell py-16"><h1>Preview interrompido</h1><p>Uma operação não permitida foi recusada. Verifique apenas o código do harness; não habilite backend.</p></section> : content : <p className="store-shell py-16" role="status">Carregando fixtures locais…</p>}</main>
    <StoreFooter categories={fixtureCategories} whatsappNumber={fixtureSettings.whatsappNumber} instagramUrl={fixtureSettings.instagramUrl} commerce={commerce} />
  </div></CartProvider>;
}

createRoot(document.getElementById("root")!).render(<Preview />);

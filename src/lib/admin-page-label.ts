// Title shown in the Admin header for the current route. Every Admin section must be listed here,
// or its pages fall back to the generic "Admin" title.

const routeLabels = [
  { path: "/admin/analytics/site", label: "Analytics do site" },
  { path: "/admin/analytics", label: "Analytics" },
  { path: "/admin/products/new", label: "Novo produto" },
  { path: "/admin/products", label: "Produtos" },
  { path: "/admin/categories", label: "Categorias" },
  { path: "/admin/promotions/new", label: "Nova promoção" },
  { path: "/admin/promotions", label: "Promoções" },
  { path: "/admin/banners", label: "Banners" },
  { path: "/admin/orders", label: "Pedidos" },
  { path: "/admin/notifications", label: "Notificações" },
  { path: "/admin/customers", label: "Clientes" },
  { path: "/admin/readiness", label: "Prontidão" },
  { path: "/admin/settings", label: "Configurações" },
  { path: "/admin/security", label: "Segurança" },
  { path: "/admin/users", label: "Usuários" },
  { path: "/admin/conta", label: "Minha conta" },
  { path: "/admin/sem-acesso", label: "Sem acesso" },
];

const exactOnlyPaths = new Set(["/admin/products/new", "/admin/promotions/new"]);

export function getAdminPageLabel(pathname: string) {
  if (pathname === "/admin") return "Visão geral";
  const route = routeLabels.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`));
  if (!route) return "Admin";
  if (pathname === route.path || exactOnlyPaths.has(route.path)) return route.label;
  if (route.path === "/admin/products") return "Editar produto";
  if (route.path === "/admin/promotions") {
    if (pathname.endsWith("/edit")) return "Editar promoção";
    if (pathname.endsWith("/preview")) return "Pré-visualizar promoção";
    return "Detalhes da promoção";
  }
  if (route.path === "/admin/categories") return "Editar categoria";
  if (route.path === "/admin/orders") return "Detalhes do pedido";
  if (route.path === "/admin/customers") return "Detalhes do cliente";
  return route.label;
}

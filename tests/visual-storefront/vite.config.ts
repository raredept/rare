import path from "node:path";
import { fileURLToPath } from "node:url";
import { isBuiltin } from "node:module";
import { defineConfig, type Plugin } from "vite";

const qaRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(qaRoot, "../..");
const mock = (name: string) => path.join(qaRoot, "mocks", name);

// This is a UI fixture preview, never a Next runtime or a database simulator.
const fixtureBackendModules = ["storefront", "settings", "home-banners", "env", "prisma", "customer-auth", "customer-actions", "shipping"];
const blockedPackages = /^(?:node:|@prisma\/|prisma(?:\/|$)|pg(?:\/|$)|stripe(?:\/|$)|redis(?:\/|$)|nodemailer(?:\/|$)|dotenv(?:\/|$)|@aws-sdk\/|web-push(?:\/|$)|server-only(?:\/|$))/;
const blockedSource = /\/(?:src\/app\/(?:api|admin)\/|prisma\/|scripts\/)|\/src\/lib\/(?:prisma|storefront|settings|home-banners|env|customer-auth|customer-actions|shipping)\.[cm]?[jt]sx?$/;

function fixtureSafety(): Plugin {
  return {
    name: "rare-fixture-only-safety",
    enforce: "pre",
    resolveId(id) {
      if (isBuiltin(id) || blockedPackages.test(id)) throw new Error(`Fixture QA refused server dependency: ${id}`);
      return null;
    },
    load(id) {
      if (blockedSource.test(id.replaceAll("\\", "/").split("?")[0])) {
        throw new Error("Fixture QA refused an unmocked backend source module.");
      }
      return null;
    },
    configureServer(server) {
      if (server.config.server.host !== "127.0.0.1" || server.config.server.port !== 4173 || !server.config.server.strictPort) {
        throw new Error("Fixture QA refused a noncanonical server binding.");
      }
      server.middlewares.use((request, response, next) => {
        const rawPath = (request.url ?? "/").split("?")[0];
        let decoded: string;
        try { decoded = decodeURIComponent(rawPath); } catch { response.statusCode = 400; response.end(); return; }
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.statusCode = 405; response.end("Fixture QA: mutations are unavailable."); return;
        }
        if (/^\/api(?:\/|$)|(?:^|\/)\.env|(?:^|\/)\.git|(?:^|\/)\.ssh|\.(?:pem|key|log)$/i.test(decoded)) {
          response.statusCode = 403; response.end("Fixture QA: resource unavailable."); return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: qaRoot,
  envDir: false,
  publicDir: path.join(repositoryRoot, "public"),
  cacheDir: path.join(repositoryRoot, "node_modules", ".vite", "rare-visual-storefront"),
  plugins: [fixtureSafety()],
  // No plugin installs and no inherited public or private application env.
  define: {
    "process.env": JSON.stringify({ NODE_ENV: "development", APP_ENV: "development", CHECKOUT_ENABLED: "false", SHIPPING_ENABLED: "false", EMAIL_DRIVER: "disabled" }),
  },
  resolve: {
    alias: [
      ...fixtureBackendModules.map((name) => ({ find: `@/lib/${name}`, replacement: mock("backend.ts") })),
      { find: "next/link", replacement: mock("link.tsx") },
      { find: "next/image", replacement: mock("image.tsx") },
      { find: "next/navigation", replacement: mock("navigation.ts") },
      { find: "next/headers", replacement: mock("server-denied.ts") },
      { find: "next/cache", replacement: mock("server-denied.ts") },
      { find: "@", replacement: path.join(repositoryRoot, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1", port: 4173, strictPort: true,
    allowedHosts: ["127.0.0.1"],
    fs: {
      allow: [repositoryRoot],
      deny: [".env", ".env.*", "**/.env*", "**/.git/**", "**/.ssh/**", "**/*.{pem,key,log}", "**/docs/security/**", "**/output/**"],
    },
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' ws://127.0.0.1:4173; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'",
      "X-Robots-Tag": "noindex, nofollow",
    },
  },
  build: { outDir: path.join(repositoryRoot, "output", "visual-storefront", "dist"), emptyOutDir: false },
});

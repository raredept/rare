import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RARE Admin",
    short_name: "RARE",
    description: "Painel administrativo da RARE.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      {
        src: "/brand/rare-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/rare-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}

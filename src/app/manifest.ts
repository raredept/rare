import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RARE Dept",
    short_name: "RARE",
    description: "Streetwear importado, drops limitados e catálogo RARE.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
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

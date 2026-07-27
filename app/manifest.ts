import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Forma — AI Weight Coach",
    short_name: "Forma",
    description: "A calm, private tracker for meals, water, weight and daily progress.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#30463e",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/forma-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/forma-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

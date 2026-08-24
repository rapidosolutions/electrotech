import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://electrotech.example";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base.replace(/\/$/, "")}/solar-bill-analyzer`, changeFrequency: "monthly", priority: 0.9 },
  ];
}

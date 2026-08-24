/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F5F2",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Electro Tech | Solar Energy & Electrical Solutions",
    description: "Electro Tech provides solar system installation, solar structures, electrical works and CCTV solutions for residential, commercial and institutional projects.",
    alternates: { canonical: "/" },
    icons: { icon: "/logos/electrotech-icon.png", shortcut: "/logos/electrotech-icon.png" },
    openGraph: {
      type: "website",
      url: origin,
      siteName: "Electro Tech",
      title: "Powering Progress With Smarter Energy | Electro Tech",
      description: "Solar installation, structures and electrical infrastructure for homes, businesses and institutions.",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 896, alt: "Electro Tech smart solar energy solutions" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Powering Progress With Smarter Energy | Electro Tech",
      description: "Electrical and solar solutions for homes, businesses and institutions.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102A1B",
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
      title: "Smart Solar Energy for Everyday Life | Electro Tech",
      description: "Solar installation, structures and electrical infrastructure for homes, businesses and institutions.",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 896, alt: "Electro Tech smart solar energy solutions" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Smart Solar Energy for Everyday Life | Electro Tech",
      description: "Electrical and solar solutions for homes, businesses and institutions.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}

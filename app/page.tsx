import { ElectroTechSite } from "@/components/electro-tech-site";
import { siteConfig } from "@/lib/site-config";

export default function Home() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.company,
      description: siteConfig.descriptor,
      foundingDate: siteConfig.established,
      telephone: siteConfig.phoneDisplay,
      email: siteConfig.email,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.company,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      provider: { "@type": "Organization", name: siteConfig.company },
      serviceType: "Solar Energy & Electrical Infrastructure Solutions",
      description: "Solar installation, solar structures, electrical works and CCTV solutions.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <ElectroTechSite />
    </>
  );
}

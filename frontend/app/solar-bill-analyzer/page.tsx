import type { Metadata } from "next";
import { SolarBillAnalyzer } from "@/components/solar-bill-analyzer";

export const metadata: Metadata = {
  title: "Solar Bill Analyzer | Electro Tech",
  description: "Upload or manually enter electricity consumption to receive a preliminary deterministic solar system recommendation for Pakistan.",
  alternates: { canonical: "/solar-bill-analyzer" },
};

export default function SolarBillAnalyzerPage() {
  return <SolarBillAnalyzer />;
}

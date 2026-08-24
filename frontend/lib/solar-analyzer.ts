export const MAX_BILL_FILE_BYTES = 10 * 1024 * 1024;
export const ANALYZER_LEAD_STORAGE_KEY = "electrotech-solar-analyzer-lead";

export const PAKISTAN_CITIES = [
  "Abbottabad", "Attock", "Bahawalpur", "Dera Ghazi Khan", "Faisalabad", "Gujranwala",
  "Gujrat", "Gwadar", "Hyderabad", "Islamabad", "Jhang", "Karachi", "Kasur", "Lahore",
  "Larkana", "Mardan", "Multan", "Murree", "Narowal", "Nawabshah", "Okara", "Peshawar",
  "Rahim Yar Khan", "Rawalpindi", "Sargodha", "Sheikhupura", "Sialkot", "Sukkur", "Swat",
  "Taxila", "Turbat", "Wah",
] as const;

export type ReadingConfidence = "high" | "medium" | "low";

export type BillExtraction = {
  provider: string | null;
  city: string | null;
  connectionType: string | null;
  phase: "single" | "three" | null;
  sanctionedLoadKw: number | null;
  consumerCategory: string | null;
  currentMonthConsumptionKwh: number | null;
  currentBillAmountPkr: number | null;
  monthlyConsumption: Array<{ year: number; month: number; kwh: number | null; confidence: ReadingConfidence }>;
  uncertainFields: string[];
};

export type EditableMonth = {
  year: number;
  month: number;
  kwh: string;
  confidence: ReadingConfidence;
};

export type VerifiedSolarInput = {
  provider?: string | null;
  city: string;
  connectionType?: string | null;
  phase?: "single" | "three" | null;
  sanctionedLoadKw?: number | null;
  monthlyConsumption: Array<{ year: number; month: number; kwh: number | null; confidence: ReadingConfidence }>;
  backupPreference?: {
    level: "essential" | "most" | "entire";
    durationHours: 2 | 4 | 6 | 8;
    backupLoadKw?: number | null;
  };
};

export type BatteryRange = { minimumKwh: number; maximumKwh: number; refined: boolean };
export type MonthSimulation = {
  month: number;
  monthName: string;
  consumptionKwh: number | null;
  generationKwh: number;
  matchedEnergyKwh: number | null;
  surplusKwh: number | null;
  shortfallKwh: number | null;
};
export type SystemRecommendation = {
  architecture: "On-Grid" | "Hybrid" | "Off-Grid";
  nominalPvKwp: number;
  actualInstalledKwp: number;
  inverterKw: number;
  panelCount: number;
  annualGenerationKwh: number;
  annualGenerationConsumptionRatio: number;
  matchedConsumptionCoveragePercent: number;
  annualSurplusKwh: number | null;
  annualShortfallKwh: number | null;
  highestSurplusMonth: string | null;
  highestShortfallMonth: string | null;
  monthlySimulation: MonthSimulation[];
  batteryRange: BatteryRange | null;
  qualification: string;
};
export type SolarRecommendationResult = {
  modelVersion: string;
  location: { requestedCity: string; profileCity: string; regionalFallbackUsed: boolean };
  dataQuality: { billAnalysisConfidence: "High" | "Medium" | "Low"; recommendationData: "Complete" | "Incomplete"; readableMonths: number };
  consumption: {
    annualConsumptionKwh: number;
    annualConsumptionEstimated: boolean;
    averageMonthlyKwh: number;
    averageDailyKwh: number;
    highestMonth: { label: string; kwh: number };
    lowestMonth: { label: string; kwh: number };
  };
  assumptions: { panelWattage: number; performanceRatio: number; solarProfileSource: { modelVersion: string; provider: string; climatologyPeriod: string } };
  bestMatch: { architecture: "On-Grid" | "Hybrid"; reason: string };
  systems: { onGrid: SystemRecommendation; hybrid: SystemRecommendation; offGrid: SystemRecommendation };
};

export type AnalyzerLeadContext = {
  source: "solar_bill_analyzer";
  systemType: "On-Grid" | "Hybrid" | "Off-Grid";
  recommendedPvKwp: number;
  actualInstalledKwp: number;
  inverterKw: number;
  batteryRange: string | null;
  annualConsumptionKwh: number;
  averageMonthlyKwh: number;
  city: string;
  billAnalysisConfidence: "High" | "Medium" | "Low";
};

export function getAnalyzerApiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("The solar analyzer API is not configured.");
}

export function analyzerApiUrl(path: string): string {
  return `${getAnalyzerApiOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function validateBillFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!extension || !allowedExtensions.includes(extension) || !allowedTypes.includes(file.type)) {
    return "Upload a PDF, JPG, JPEG, or PNG electricity bill.";
  }
  if (file.size === 0) return "The selected bill is empty.";
  if (file.size > MAX_BILL_FILE_BYTES) return "The bill must be 10 MB or smaller.";
  return null;
}

export function createTwelveMonthGrid(readings: BillExtraction["monthlyConsumption"] = [], today = new Date()): EditableMonth[] {
  const valid = readings.filter((reading) => reading.year >= 2000 && reading.month >= 1 && reading.month <= 12);
  const latest = [...valid].sort((a, b) => b.year - a.year || b.month - a.month)[0];
  const anchor = latest ? new Date(Date.UTC(latest.year, latest.month - 1, 1)) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const byKey = new Map(valid.map((reading) => [`${reading.year}-${reading.month}`, reading]));
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (11 - index), 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const reading = byKey.get(`${year}-${month}`);
    return { year, month, kwh: reading?.kwh === null || reading?.kwh === undefined ? "" : String(reading.kwh), confidence: reading?.confidence ?? "low" };
  });
}

export function summarizeConsumption(months: readonly EditableMonth[]) {
  const values = months.flatMap((month) => {
    const value = Number(month.kwh);
    return month.kwh.trim() !== "" && Number.isFinite(value) && value >= 0 ? [{ ...month, value }] : [];
  });
  if (values.length === 0) return null;
  const total = values.reduce((sum, month) => sum + month.value, 0);
  const averageMonthly = total / values.length;
  const highest = [...values].sort((a, b) => b.value - a.value)[0]!;
  const lowest = [...values].sort((a, b) => a.value - b.value)[0]!;
  return {
    readableMonths: values.length,
    annualConsumption: values.length === 12 ? total : averageMonthly * 12,
    estimated: values.length !== 12,
    averageMonthly,
    averageDaily: averageMonthly * 12 / 365,
    highest,
    lowest,
  };
}

export function batteryRangeLabel(range: BatteryRange | null): string | null {
  if (!range) return null;
  if (range.minimumKwh === range.maximumKwh) return `${range.minimumKwh} kWh`;
  return `${range.minimumKwh}–${range.maximumKwh} kWh`;
}

export function createAnalyzerLeadContext(result: SolarRecommendationResult, architecture: keyof SolarRecommendationResult["systems"] = "onGrid"): AnalyzerLeadContext {
  const system = result.systems[architecture];
  return {
    source: "solar_bill_analyzer",
    systemType: system.architecture,
    recommendedPvKwp: system.nominalPvKwp,
    actualInstalledKwp: system.actualInstalledKwp,
    inverterKw: system.inverterKw,
    batteryRange: batteryRangeLabel(system.batteryRange),
    annualConsumptionKwh: result.consumption.annualConsumptionKwh,
    averageMonthlyKwh: result.consumption.averageMonthlyKwh,
    city: result.location.requestedCity,
    billAnalysisConfidence: result.dataQuality.billAnalysisConfidence,
  };
}

export function analyzerLeadMessage(context: AnalyzerLeadContext): string {
  return [
    "Solar Bill Analyzer preliminary result:",
    `${context.actualInstalledKwp} kWp ${context.systemType}; ${context.inverterKw} kW inverter${context.batteryRange ? `; battery ${context.batteryRange}` : ""}.`,
    `Location: ${context.city}. Annual consumption: ${Math.round(context.annualConsumptionKwh).toLocaleString("en-PK")} kWh.`,
    `Bill analysis confidence: ${context.billAnalysisConfidence}. Please provide an exact solar proposal.`,
  ].join(" ");
}

export function saveAnalyzerLeadContext(context: AnalyzerLeadContext): void {
  window.sessionStorage.setItem(ANALYZER_LEAD_STORAGE_KEY, JSON.stringify(context));
}

export function consumeAnalyzerLeadContext(): AnalyzerLeadContext | null {
  const raw = window.sessionStorage.getItem(ANALYZER_LEAD_STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(ANALYZER_LEAD_STORAGE_KEY);
  try {
    const value = JSON.parse(raw) as Partial<AnalyzerLeadContext>;
    if (value.source !== "solar_bill_analyzer" || !value.city || !value.systemType || typeof value.actualInstalledKwp !== "number") return null;
    return value as AnalyzerLeadContext;
  } catch {
    return null;
  }
}

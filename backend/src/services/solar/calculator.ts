import type { VerifiedSolarInput } from "../../validation/solar-analyzer.js";
import { assessDataConfidence } from "../../validation/solar-analyzer.js";
import {
  BACKUP_LEVEL_FACTORS,
  PRACTICAL_INVERTER_CAPACITIES_KW,
  PRACTICAL_PV_CAPACITIES_KWP,
  SOLAR_ASSUMPTIONS,
} from "./assumptions.js";
import { getSolarProfile, SOLAR_PROFILE_SOURCE } from "./profiles.js";

const DAYS_IN_MONTH = Object.freeze([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
const MONTH_NAMES = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

function round(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function roundBatteryCapacity(requiredKwh: number): number {
  const modules = Math.max(1, Math.ceil(requiredKwh / SOLAR_ASSUMPTIONS.batteryModuleKwh));
  return round(modules * SOLAR_ASSUMPTIONS.batteryModuleKwh, 2);
}

export type MonthSimulation = {
  month: number;
  monthName: string;
  consumptionKwh: number | null;
  generationKwh: number;
  matchedEnergyKwh: number | null;
  surplusKwh: number | null;
  shortfallKwh: number | null;
};

export type BatteryRange = {
  minimumKwh: number;
  maximumKwh: number;
  refined: boolean;
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
  location: {
    requestedCity: string;
    profileCity: string;
    regionalFallbackUsed: boolean;
  };
  dataQuality: {
    billAnalysisConfidence: "High" | "Medium" | "Low";
    recommendationData: "Complete" | "Incomplete";
    readableMonths: number;
  };
  consumption: {
    annualConsumptionKwh: number;
    annualConsumptionEstimated: boolean;
    averageMonthlyKwh: number;
    averageDailyKwh: number;
    highestMonth: { label: string; kwh: number };
    lowestMonth: { label: string; kwh: number };
  };
  assumptions: {
    panelWattage: number;
    performanceRatio: number;
    solarProfileSource: typeof SOLAR_PROFILE_SOURCE;
  };
  bestMatch: {
    architecture: "On-Grid" | "Hybrid";
    reason: string;
  };
  systems: {
    onGrid: SystemRecommendation;
    hybrid: SystemRecommendation;
    offGrid: SystemRecommendation;
  };
};

type CandidateEvaluation = Omit<SystemRecommendation, "architecture" | "batteryRange" | "qualification">;

export function panelConfiguration(nominalPvKwp: number) {
  const panelCount = Math.ceil((nominalPvKwp * 1000) / SOLAR_ASSUMPTIONS.panelWattage);
  return {
    panelCount,
    actualInstalledKwp: round((panelCount * SOLAR_ASSUMPTIONS.panelWattage) / 1000, 3),
  };
}

export function selectInverterSize(actualInstalledKwp: number): number {
  const compatible = PRACTICAL_INVERTER_CAPACITIES_KW
    .map((inverterKw) => ({ inverterKw, ratio: actualInstalledKwp / inverterKw }))
    .filter(({ ratio }) => ratio >= SOLAR_ASSUMPTIONS.dcAcRatioMin && ratio <= SOLAR_ASSUMPTIONS.dcAcRatioMax)
    .sort((a, b) =>
      Math.abs(a.ratio - SOLAR_ASSUMPTIONS.dcAcRatioTarget) -
      Math.abs(b.ratio - SOLAR_ASSUMPTIONS.dcAcRatioTarget),
    );
  if (compatible[0]) return compatible[0].inverterKw;

  return [...PRACTICAL_INVERTER_CAPACITIES_KW].sort(
    (a, b) => Math.abs(actualInstalledKwp / a - SOLAR_ASSUMPTIONS.dcAcRatioTarget) -
      Math.abs(actualInstalledKwp / b - SOLAR_ASSUMPTIONS.dcAcRatioTarget),
  )[0]!;
}

function consumptionByCalendarMonth(input: VerifiedSolarInput): Map<number, number> {
  const sorted = [...input.monthlyConsumption].sort((a, b) => a.year - b.year || a.month - b.month);
  const map = new Map<number, number>();
  for (const reading of sorted) {
    if (reading.kwh !== null) map.set(reading.month, reading.kwh);
  }
  return map;
}

function evaluateCandidate(
  nominalPvKwp: number,
  profilePsh: readonly number[],
  consumptionMap: Map<number, number>,
  annualConsumptionKwh: number,
  performanceRatio: number,
): CandidateEvaluation {
  const { panelCount, actualInstalledKwp } = panelConfiguration(nominalPvKwp);
  const monthlySimulation: MonthSimulation[] = profilePsh.map((psh, index) => {
    const month = index + 1;
    const generationKwh = round(actualInstalledKwp * psh * DAYS_IN_MONTH[index]! * performanceRatio);
    const consumptionKwh = consumptionMap.get(month) ?? null;
    return {
      month,
      monthName: MONTH_NAMES[index]!,
      consumptionKwh,
      generationKwh,
      matchedEnergyKwh: consumptionKwh === null ? null : round(Math.min(generationKwh, consumptionKwh)),
      surplusKwh: consumptionKwh === null ? null : round(Math.max(0, generationKwh - consumptionKwh)),
      shortfallKwh: consumptionKwh === null ? null : round(Math.max(0, consumptionKwh - generationKwh)),
    };
  });

  const annualGenerationKwh = round(monthlySimulation.reduce((sum, month) => sum + month.generationKwh, 0));
  const observedConsumption = monthlySimulation.reduce((sum, month) => sum + (month.consumptionKwh ?? 0), 0);
  const matched = monthlySimulation.reduce((sum, month) => sum + (month.matchedEnergyKwh ?? 0), 0);
  const isComplete = monthlySimulation.every((month) => month.consumptionKwh !== null);
  const withConsumption = monthlySimulation.filter((month) => month.consumptionKwh !== null);
  const surplusPeak = [...withConsumption].sort((a, b) => (b.surplusKwh ?? 0) - (a.surplusKwh ?? 0))[0];
  const shortfallPeak = [...withConsumption].sort((a, b) => (b.shortfallKwh ?? 0) - (a.shortfallKwh ?? 0))[0];

  return {
    nominalPvKwp,
    actualInstalledKwp,
    inverterKw: selectInverterSize(actualInstalledKwp),
    panelCount,
    annualGenerationKwh,
    annualGenerationConsumptionRatio: round(annualGenerationKwh / annualConsumptionKwh, 3),
    matchedConsumptionCoveragePercent: round(observedConsumption > 0 ? (matched / observedConsumption) * 100 : 0),
    annualSurplusKwh: isComplete ? round(monthlySimulation.reduce((sum, month) => sum + (month.surplusKwh ?? 0), 0)) : null,
    annualShortfallKwh: isComplete ? round(monthlySimulation.reduce((sum, month) => sum + (month.shortfallKwh ?? 0), 0)) : null,
    highestSurplusMonth: surplusPeak && (surplusPeak.surplusKwh ?? 0) > 0 ? surplusPeak.monthName : null,
    highestShortfallMonth: shortfallPeak && (shortfallPeak.shortfallKwh ?? 0) > 0 ? shortfallPeak.monthName : null,
    monthlySimulation,
  };
}

function chooseOnGridCandidate(candidates: CandidateEvaluation[]): CandidateEvaluation {
  const inTargetBand = candidates.filter((candidate) =>
    candidate.annualGenerationConsumptionRatio >= SOLAR_ASSUMPTIONS.annualGenerationTargetMin &&
    candidate.annualGenerationConsumptionRatio <= SOLAR_ASSUMPTIONS.annualGenerationTargetMax,
  );
  const pool = inTargetBand.length > 0 ? inTargetBand : candidates;

  return [...pool].sort((a, b) => {
    const aDistance = Math.abs(a.annualGenerationConsumptionRatio - 1) + Math.max(0, a.annualGenerationConsumptionRatio - 1) * 0.35;
    const bDistance = Math.abs(b.annualGenerationConsumptionRatio - 1) + Math.max(0, b.annualGenerationConsumptionRatio - 1) * 0.35;
    if (Math.abs(aDistance - bDistance) > 0.03) return aDistance - bDistance;
    const coverageDifference = b.matchedConsumptionCoveragePercent - a.matchedConsumptionCoveragePercent;
    if (Math.abs(coverageDifference) > SOLAR_ASSUMPTIONS.smallerCandidateCoverageTolerance * 100) return coverageDifference;
    return a.nominalPvKwp - b.nominalPvKwp;
  })[0]!;
}

function preliminaryHybridBatteryRange(averageDailyKwh: number): BatteryRange {
  const usableCorrection = SOLAR_ASSUMPTIONS.batterySafetyMargin /
    (SOLAR_ASSUMPTIONS.batteryDepthOfDischarge * SOLAR_ASSUMPTIONS.batteryEfficiency);
  return {
    minimumKwh: roundBatteryCapacity(averageDailyKwh * 0.2 * usableCorrection),
    maximumKwh: roundBatteryCapacity(averageDailyKwh * 0.4 * usableCorrection),
    refined: false,
  };
}

export function refinedBatteryRange(input: VerifiedSolarInput, averageDailyKwh: number): BatteryRange | null {
  const preference = input.backupPreference;
  if (!preference) return null;
  const estimatedBackupLoadKw = preference.backupLoadKw ??
    (averageDailyKwh / 24) * BACKUP_LEVEL_FACTORS[preference.level];
  const required = estimatedBackupLoadKw * preference.durationHours /
    (SOLAR_ASSUMPTIONS.batteryDepthOfDischarge * SOLAR_ASSUMPTIONS.batteryEfficiency) *
    SOLAR_ASSUMPTIONS.batterySafetyMargin;
  const nominal = roundBatteryCapacity(required);
  return { minimumKwh: nominal, maximumKwh: nominal, refined: true };
}

function offGridBatteryRange(averageDailyKwh: number): BatteryRange {
  const requiredOneDay = averageDailyKwh /
    (SOLAR_ASSUMPTIONS.batteryDepthOfDischarge * SOLAR_ASSUMPTIONS.batteryEfficiency) *
    SOLAR_ASSUMPTIONS.batterySafetyMargin;
  return {
    minimumKwh: roundBatteryCapacity(requiredOneDay),
    maximumKwh: roundBatteryCapacity(requiredOneDay * 2),
    refined: false,
  };
}

function toSystem(
  architecture: SystemRecommendation["architecture"],
  evaluation: CandidateEvaluation,
  batteryRange: BatteryRange | null,
  qualification: string,
): SystemRecommendation {
  return { architecture, ...evaluation, batteryRange, qualification };
}

export function calculateSolarRecommendation(input: VerifiedSolarInput): SolarRecommendationResult {
  const usableReadings = input.monthlyConsumption.filter((reading) => reading.kwh !== null);
  if (usableReadings.length === 0) throw new Error("At least one readable monthly consumption value is required.");

  const totalObserved = usableReadings.reduce((sum, reading) => sum + (reading.kwh ?? 0), 0);
  const averageMonthlyKwh = totalObserved / usableReadings.length;
  const annualConsumptionKwh = usableReadings.length === 12 ? totalObserved : averageMonthlyKwh * 12;
  const averageDailyKwh = annualConsumptionKwh / 365;
  const highest = [...usableReadings].sort((a, b) => (b.kwh ?? 0) - (a.kwh ?? 0))[0]!;
  const lowest = [...usableReadings].sort((a, b) => (a.kwh ?? 0) - (b.kwh ?? 0))[0]!;
  const { profile, fallbackUsed } = getSolarProfile(input.city);
  const consumptionMap = consumptionByCalendarMonth(input);

  const candidates = PRACTICAL_PV_CAPACITIES_KWP.map((nominal) =>
    evaluateCandidate(nominal, profile.monthlyPeakSunHours, consumptionMap, annualConsumptionKwh, SOLAR_ASSUMPTIONS.performanceRatio),
  );
  const onGridEvaluation = chooseOnGridCandidate(candidates);

  const weakestPsh = Math.min(...profile.monthlyPeakSunHours);
  const conservativeOffGridKwp = averageDailyKwh / (weakestPsh * SOLAR_ASSUMPTIONS.offGridPerformanceRatio) * SOLAR_ASSUMPTIONS.offGridReserveFactor;
  const offGridNominal = PRACTICAL_PV_CAPACITIES_KWP.find((capacity) => capacity >= conservativeOffGridKwp) ?? 1000;
  const offGridEvaluation = evaluateCandidate(
    offGridNominal,
    profile.monthlyPeakSunHours,
    consumptionMap,
    annualConsumptionKwh,
    SOLAR_ASSUMPTIONS.offGridPerformanceRatio,
  );

  const confidence = assessDataConfidence(input.monthlyConsumption, []);
  const refined = refinedBatteryRange(input, averageDailyKwh);
  const hybridBattery = refined ?? preliminaryHybridBatteryRange(averageDailyKwh);
  const onGrid = toSystem(
    "On-Grid",
    onGridEvaluation,
    null,
    "Strong preliminary bill-reduction configuration; export or net-metering benefits are not assumed.",
  );
  const hybrid = toSystem(
    "Hybrid",
    onGridEvaluation,
    hybridBattery,
    "Backup-capable alternative. Battery sizing remains preliminary until backup loads and duration are verified.",
  );
  const offGrid = toSystem(
    "Off-Grid",
    offGridEvaluation,
    offGridBatteryRange(averageDailyKwh),
    "Preliminary Off-Grid Estimate — detailed load assessment required for final engineering.",
  );

  const phaseNote = input.phase ? ` The bill indicates a ${input.phase}-phase connection.` : "";
  return {
    modelVersion: SOLAR_PROFILE_SOURCE.modelVersion,
    location: { requestedCity: input.city, profileCity: profile.city, regionalFallbackUsed: fallbackUsed },
    dataQuality: { ...confidence, readableMonths: usableReadings.length },
    consumption: {
      annualConsumptionKwh: round(annualConsumptionKwh),
      annualConsumptionEstimated: usableReadings.length !== 12,
      averageMonthlyKwh: round(averageMonthlyKwh),
      averageDailyKwh: round(averageDailyKwh),
      highestMonth: { label: `${MONTH_NAMES[highest.month - 1]} ${highest.year}`, kwh: highest.kwh! },
      lowestMonth: { label: `${MONTH_NAMES[lowest.month - 1]} ${lowest.year}`, kwh: lowest.kwh! },
    },
    assumptions: {
      panelWattage: SOLAR_ASSUMPTIONS.panelWattage,
      performanceRatio: SOLAR_ASSUMPTIONS.performanceRatio,
      solarProfileSource: SOLAR_PROFILE_SOURCE,
    },
    bestMatch: input.backupPreference ? {
      architecture: "Hybrid",
      reason: `Hybrid is the best preliminary match after applying the stated ${input.backupPreference.durationHours}-hour backup requirement. The PV size still follows verified consumption, while battery capacity follows the stated backup level${input.backupPreference.backupLoadKw ? " and known backup load" : " using the disclosed estimation assumption"}.${phaseNote}`,
    } : {
      architecture: "On-Grid",
      reason: `On-Grid is the best preliminary bill-reduction match because the verified bill data establishes energy use but does not establish a backup-power requirement. The ${onGrid.nominalPvKwp} kWp commercial size balances estimated annual generation with consumption while limiting unnecessary oversizing.${phaseNote}`,
    },
    systems: { onGrid, hybrid, offGrid },
  };
}

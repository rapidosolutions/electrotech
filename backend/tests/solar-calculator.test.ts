import assert from "node:assert/strict";
import test from "node:test";
import { calculateSolarRecommendation, panelConfiguration, refinedBatteryRange, selectInverterSize } from "../src/services/solar/calculator.js";
import { SOLAR_ASSUMPTIONS } from "../src/services/solar/assumptions.js";
import { getSolarProfile } from "../src/services/solar/profiles.js";
import type { VerifiedSolarInput } from "../src/validation/solar-analyzer.js";

const completeInput: VerifiedSolarInput = {
  city: "Islamabad",
  phase: "three",
  monthlyConsumption: Array.from({ length: 12 }, (_, index) => ({
    year: index < 6 ? 2025 : 2026,
    month: index + 1,
    kwh: 1_000 + index * 10,
    confidence: "high" as const,
  })),
};

test("calculates annual, monthly, daily, highest and lowest consumption in application code", () => {
  const result = calculateSolarRecommendation(completeInput);
  assert.equal(result.consumption.annualConsumptionKwh, 12_660);
  assert.equal(result.consumption.annualConsumptionEstimated, false);
  assert.equal(result.consumption.averageMonthlyKwh, 1_055);
  assert.equal(result.consumption.averageDailyKwh, 34.7);
  assert.deepEqual(result.consumption.highestMonth, { label: "December 2026", kwh: 1_110 });
  assert.deepEqual(result.consumption.lowestMonth, { label: "January 2025", kwh: 1_000 });
});

test("keeps missing months explicit while annualizing only the sizing baseline", () => {
  const result = calculateSolarRecommendation({ ...completeInput, monthlyConsumption: completeInput.monthlyConsumption.slice(0, 6) });
  assert.equal(result.dataQuality.recommendationData, "Incomplete");
  assert.equal(result.consumption.annualConsumptionEstimated, true);
  assert.equal(result.systems.onGrid.annualSurplusKwh, null);
  assert.equal(result.systems.onGrid.monthlySimulation[9]?.consumptionKwh, null);
});

test("uses exact city profiles and a documented conservative regional fallback", () => {
  assert.equal(getSolarProfile("Karachi").profile.city, "Karachi");
  assert.equal(getSolarProfile("Karachi").fallbackUsed, false);
  assert.equal(getSolarProfile("Attock").profile.city, "Islamabad");
  assert.equal(getSolarProfile("Attock").fallbackUsed, true);
  assert.equal(getSolarProfile("Unsupported Pakistan City").profile.city, "Islamabad");
});

test("applies the configured performance ratio to monthly generation", () => {
  const result = calculateSolarRecommendation(completeInput);
  const january = result.systems.onGrid.monthlySimulation[0]!;
  const expected = result.systems.onGrid.actualInstalledKwp * 2.9126 * 31 * SOLAR_ASSUMPTIONS.performanceRatio;
  assert.ok(Math.abs(january.generationKwh - expected) < 0.1);
});

test("rounds panel quantity upward and uses actual installed capacity", () => {
  assert.deepEqual(panelConfiguration(10), { panelCount: 18, actualInstalledKwp: 10.53 });
});

test("selects practical inverter sizes within the configured DC/AC range", () => {
  const inverter = selectInverterSize(10.53);
  assert.ok([8, 10].includes(inverter));
  const ratio = 10.53 / inverter;
  assert.ok(ratio >= SOLAR_ASSUMPTIONS.dcAcRatioMin && ratio <= SOLAR_ASSUMPTIONS.dcAcRatioMax);
});

test("selects only practical PV candidates and calculates surplus, shortfall and coverage", () => {
  const result = calculateSolarRecommendation(completeInput);
  assert.ok([5, 6, 8, 10, 12, 15, 20].includes(result.systems.onGrid.nominalPvKwp));
  assert.ok(result.systems.onGrid.matchedConsumptionCoveragePercent > 0);
  assert.notEqual(result.systems.onGrid.annualSurplusKwh, null);
  assert.notEqual(result.systems.onGrid.annualShortfallKwh, null);
});

test("provides preliminary Hybrid and conservative Off-Grid battery estimates", () => {
  const result = calculateSolarRecommendation(completeInput);
  assert.ok(result.systems.hybrid.batteryRange!.minimumKwh >= SOLAR_ASSUMPTIONS.batteryModuleKwh);
  assert.ok(result.systems.offGrid.nominalPvKwp >= result.systems.onGrid.nominalPvKwp);
  assert.ok(result.systems.offGrid.batteryRange!.maximumKwh > result.systems.offGrid.batteryRange!.minimumKwh);
});

test("refines battery capacity deterministically from a known backup load", () => {
  const refined = refinedBatteryRange({
    ...completeInput,
    backupPreference: { level: "essential", durationHours: 4, backupLoadKw: 5 },
  }, 34.7);
  const raw = 5 * 4 / (SOLAR_ASSUMPTIONS.batteryDepthOfDischarge * SOLAR_ASSUMPTIONS.batteryEfficiency) * SOLAR_ASSUMPTIONS.batterySafetyMargin;
  assert.ok(refined!.minimumKwh >= raw);
  assert.equal(refined!.minimumKwh, refined!.maximumKwh);
  assert.equal(refined!.refined, true);
  const recommendation = calculateSolarRecommendation({
    ...completeInput,
    backupPreference: { level: "essential", durationHours: 4, backupLoadKw: 5 },
  });
  assert.equal(recommendation.bestMatch.architecture, "Hybrid");
});

test("best-match explanation is deterministic and never infers backup demand", () => {
  const first = calculateSolarRecommendation(completeInput);
  const second = calculateSolarRecommendation(completeInput);
  assert.equal(first.bestMatch.architecture, "On-Grid");
  assert.equal(first.bestMatch.reason, second.bestMatch.reason);
  assert.match(first.bestMatch.reason, /does not establish a backup-power requirement/);
});

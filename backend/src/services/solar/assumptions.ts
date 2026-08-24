export const SOLAR_MODEL_VERSION = "pk-nasa-power-2001-2020-v1";

export const SOLAR_ASSUMPTIONS = Object.freeze({
  performanceRatio: 0.78,
  offGridPerformanceRatio: 0.72,
  panelWattage: 585,
  dcAcRatioMin: 1.1,
  dcAcRatioMax: 1.35,
  dcAcRatioTarget: 1.2,
  batteryDepthOfDischarge: 0.8,
  batteryEfficiency: 0.92,
  batterySafetyMargin: 1.15,
  batteryModuleKwh: 5.12,
  offGridReserveFactor: 1.2,
  smallerCandidateCoverageTolerance: 0.02,
  annualGenerationTargetMin: 0.85,
  annualGenerationTargetMax: 1.15,
});

export const PRACTICAL_PV_CAPACITIES_KWP = Object.freeze([
  5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250,
  300, 400, 500, 750, 1000,
]);

export const PRACTICAL_INVERTER_CAPACITIES_KW = Object.freeze([
  5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250,
  300, 400, 500, 630, 750, 1000,
]);

export const BACKUP_LEVEL_FACTORS = Object.freeze({
  essential: 0.25,
  most: 0.55,
  entire: 0.9,
});

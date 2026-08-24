import { SOLAR_MODEL_VERSION } from "./assumptions.js";

export type SolarProfile = {
  city: string;
  coordinates: { latitude: number; longitude: number };
  monthlyPeakSunHours: readonly number[];
};

// NASA POWER ALLSKY_SFC_SW_DWN, Renewable Energy community, monthly climatology
// for 2001-2020. Values are kWh/m²/day and are used as monthly peak-sun-hours/day.
// Source: https://power.larc.nasa.gov/api/temporal/climatology/point
// Dataset version: pk-nasa-power-2001-2020-v1 (retrieved 2026-08-24).
export const SOLAR_PROFILE_SOURCE = Object.freeze({
  modelVersion: SOLAR_MODEL_VERSION,
  provider: "NASA POWER",
  parameter: "ALLSKY_SFC_SW_DWN",
  climatologyPeriod: "2001-2020",
  unit: "kWh/m²/day (equivalent peak sun hours/day)",
  url: "https://power.larc.nasa.gov/docs/services/api/temporal/climatology/",
});

export const PAKISTAN_SOLAR_PROFILES: Readonly<Record<string, SolarProfile>> = Object.freeze({
  islamabad: { city: "Islamabad", coordinates: { latitude: 33.6844, longitude: 73.0479 }, monthlyPeakSunHours: [2.9126, 3.5009, 4.8053, 6.025, 6.9874, 6.9746, 5.8702, 5.3851, 5.3561, 4.6666, 3.4445, 2.8375] },
  rawalpindi: { city: "Rawalpindi", coordinates: { latitude: 33.5651, longitude: 73.0169 }, monthlyPeakSunHours: [2.9126, 3.5009, 4.8053, 6.025, 6.9874, 6.9746, 5.8702, 5.3851, 5.3561, 4.6666, 3.4445, 2.8375] },
  lahore: { city: "Lahore", coordinates: { latitude: 31.5204, longitude: 74.3587 }, monthlyPeakSunHours: [2.9153, 4.014, 5.2822, 6.3036, 6.8998, 6.4927, 5.5426, 5.3722, 5.2915, 4.6145, 3.5292, 2.9016] },
  karachi: { city: "Karachi", coordinates: { latitude: 24.8607, longitude: 67.0011 }, monthlyPeakSunHours: [4.3814, 5.3479, 6.3384, 7.0049, 7.1498, 6.5405, 5.2802, 5.2078, 5.7862, 5.5795, 4.6207, 4.1311] },
  faisalabad: { city: "Faisalabad", coordinates: { latitude: 31.4504, longitude: 73.135 }, monthlyPeakSunHours: [2.7775, 3.8887, 5.1432, 6.223, 6.7454, 6.3667, 5.5248, 5.3978, 5.2234, 4.3728, 3.2674, 2.7662] },
  multan: { city: "Multan", coordinates: { latitude: 30.1575, longitude: 71.5249 }, monthlyPeakSunHours: [3.1469, 4.1582, 5.3482, 6.4435, 6.9754, 6.5914, 5.8898, 5.6981, 5.4158, 4.6006, 3.5124, 3.0643] },
  peshawar: { city: "Peshawar", coordinates: { latitude: 34.0151, longitude: 71.5249 }, monthlyPeakSunHours: [2.9748, 3.4807, 4.7251, 6.1346, 7.3212, 7.7419, 6.9689, 6.282, 5.8409, 4.8482, 3.4654, 2.8985] },
  hyderabad: { city: "Hyderabad", coordinates: { latitude: 25.396, longitude: 68.3578 }, monthlyPeakSunHours: [4.1633, 5.0436, 6.0898, 6.7723, 7.0236, 6.6948, 5.9033, 5.8308, 5.8716, 5.4002, 4.357, 3.9322] },
  quetta: { city: "Quetta", coordinates: { latitude: 30.1798, longitude: 66.975 }, monthlyPeakSunHours: [3.7265, 4.4678, 5.8682, 6.9852, 7.915, 8.4511, 7.9054, 7.4366, 6.8374, 5.7043, 4.3646, 3.7166] },
  sialkot: { city: "Sialkot", coordinates: { latitude: 32.4945, longitude: 74.5229 }, monthlyPeakSunHours: [2.9942, 3.9233, 5.2529, 6.3384, 7.2019, 7.0733, 5.989, 5.622, 5.5694, 4.985, 3.7337, 3.03] },
  gujranwala: { city: "Gujranwala", coordinates: { latitude: 32.1877, longitude: 74.1945 }, monthlyPeakSunHours: [2.9942, 3.9233, 5.2529, 6.3384, 7.2019, 7.0733, 5.989, 5.622, 5.5694, 4.985, 3.7337, 3.03] },
  bahawalpur: { city: "Bahawalpur", coordinates: { latitude: 29.3956, longitude: 71.6836 }, monthlyPeakSunHours: [3.2796, 4.3807, 5.6047, 6.5738, 6.9278, 6.523, 6.1133, 5.9784, 5.7211, 4.8746, 3.7015, 3.1829] },
});

const CITY_PROFILE_ALIASES: Readonly<Record<string, keyof typeof PAKISTAN_SOLAR_PROFILES>> = Object.freeze({
  attock: "islamabad",
  wah: "islamabad",
  taxila: "islamabad",
  murree: "islamabad",
  kasur: "lahore",
  sheikhupura: "lahore",
  okara: "lahore",
  sargodha: "faisalabad",
  jhang: "faisalabad",
  gujrat: "sialkot",
  narowal: "sialkot",
  sukkur: "hyderabad",
  larkana: "hyderabad",
  nawabshah: "hyderabad",
  gwadar: "karachi",
  turbat: "karachi",
  dera_ghazi_khan: "multan",
  rahim_yar_khan: "bahawalpur",
  abbottabad: "islamabad",
  mardan: "peshawar",
  swat: "peshawar",
});

function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function getSolarProfile(city: string): { profile: SolarProfile; fallbackUsed: boolean } {
  const normalized = normalizeCity(city);
  const direct = PAKISTAN_SOLAR_PROFILES[normalized];
  if (direct) return { profile: direct, fallbackUsed: false };

  const alias = CITY_PROFILE_ALIASES[normalized];
  if (alias) return { profile: PAKISTAN_SOLAR_PROFILES[alias]!, fallbackUsed: true };

  // Islamabad is the conservative unsupported-location fallback: among the
  // supported profiles it has a lower annual solar resource than most regions.
  return { profile: PAKISTAN_SOLAR_PROFILES.islamabad!, fallbackUsed: true };
}

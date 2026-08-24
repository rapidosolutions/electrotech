import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SolarBillAnalyzer } from "@/components/solar-bill-analyzer";
import {
  analyzerLeadMessage,
  consumeAnalyzerLeadContext,
  createAnalyzerLeadContext,
  createTwelveMonthGrid,
  saveAnalyzerLeadContext,
  summarizeConsumption,
  validateBillFile,
  type SolarRecommendationResult,
} from "@/lib/solar-analyzer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

const extraction = {
  provider: "IESCO",
  city: "Islamabad",
  connectionType: "Residential",
  phase: "single" as const,
  sanctionedLoadKw: 5,
  consumerCategory: "A-1",
  currentMonthConsumptionKwh: 420,
  currentBillAmountPkr: 24_000,
  monthlyConsumption: Array.from({ length: 12 }, (_, index) => ({ year: 2026, month: index + 1, kwh: 400 + index, confidence: "high" as const })),
  uncertainFields: [],
};

function system(architecture: "On-Grid" | "Hybrid" | "Off-Grid", battery = false) {
  return {
    architecture,
    nominalPvKwp: architecture === "Off-Grid" ? 12 : 10,
    actualInstalledKwp: architecture === "Off-Grid" ? 12.285 : 10.53,
    inverterKw: architecture === "Off-Grid" ? 10 : 8,
    panelCount: architecture === "Off-Grid" ? 21 : 18,
    annualGenerationKwh: 15_000,
    annualGenerationConsumptionRatio: 1.1,
    matchedConsumptionCoveragePercent: 83,
    annualSurplusKwh: 2_000,
    annualShortfallKwh: 1_000,
    highestSurplusMonth: "May",
    highestShortfallMonth: "December",
    monthlySimulation: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, monthName: new Date(2026, index).toLocaleString("en", { month: "long" }), consumptionKwh: 400 + index, generationKwh: 500 + index, matchedEnergyKwh: 400 + index, surplusKwh: 100, shortfallKwh: 0 })),
    batteryRange: battery ? { minimumKwh: 10.24, maximumKwh: 20.48, refined: false } : null,
    qualification: architecture === "Off-Grid" ? "Preliminary Off-Grid Estimate — detailed load assessment required for final engineering." : "Preliminary configuration.",
  };
}

const recommendation: SolarRecommendationResult = {
  modelVersion: "test-v1",
  location: { requestedCity: "Islamabad", profileCity: "Islamabad", regionalFallbackUsed: false },
  dataQuality: { billAnalysisConfidence: "High", recommendationData: "Complete", readableMonths: 12 },
  consumption: { annualConsumptionKwh: 14_850, annualConsumptionEstimated: false, averageMonthlyKwh: 1_237.5, averageDailyKwh: 40.7, highestMonth: { label: "June 2026", kwh: 1_400 }, lowestMonth: { label: "January 2026", kwh: 1_000 } },
  assumptions: { panelWattage: 585, performanceRatio: .78, solarProfileSource: { modelVersion: "test-v1", provider: "NASA POWER", climatologyPeriod: "2001-2020" } },
  bestMatch: { architecture: "On-Grid", reason: "The bill establishes energy use but not backup demand." },
  systems: { onGrid: system("On-Grid"), hybrid: system("Hybrid", true), offGrid: system("Off-Grid", true) },
};

describe("solar analyzer utilities", () => {
  test("validates uploads and keeps missing months explicit", () => {
    expect(validateBillFile(new File(["x"], "bill.txt", { type: "text/plain" }))).toMatch(/PDF/);
    expect(validateBillFile(new File([], "bill.pdf", { type: "application/pdf" }))).toMatch(/empty/);
    expect(validateBillFile(new File(["%PDF"], "bill.pdf", { type: "application/pdf" }))).toBeNull();
    const grid = createTwelveMonthGrid(extraction.monthlyConsumption.slice(0, 6), new Date("2026-12-01"));
    expect(grid).toHaveLength(12);
    expect(grid.filter((month) => !month.kwh)).toHaveLength(6);
  });

  test("calculates editable summaries and non-sensitive lead/WhatsApp context", () => {
    const grid = createTwelveMonthGrid(extraction.monthlyConsumption);
    const summary = summarizeConsumption(grid)!;
    expect(summary.readableMonths).toBe(12);
    expect(summary.highest.value).toBe(411);
    const context = createAnalyzerLeadContext(recommendation);
    expect(context.source).toBe("solar_bill_analyzer");
    expect(analyzerLeadMessage(context)).toContain("10.53 kWp On-Grid");
    expect(analyzerLeadMessage(context)).not.toMatch(/account|meter|consumer number/i);
    saveAnalyzerLeadContext(context);
    expect(consumeAnalyzerLeadContext()).toEqual(context);
    expect(consumeAnalyzerLeadContext()).toBeNull();
  });
});

describe("solar analyzer customer flow", () => {
  test("opens a complete manual-entry path without Gemini", async () => {
    const user = userEvent.setup();
    render(<SolarBillAnalyzer />);
    expect(screen.getByRole("heading", { name: /Upload your electricity bill/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Enter Consumption Manually/i }));
    expect(screen.getByRole("heading", { name: /Check the readings before sizing/i })).toBeTruthy();
    expect(screen.getAllByLabelText(/consumption in kWh/i)).toHaveLength(12);
  });

  test("uploads a bill, reviews extraction, applies corrections, and calculates results", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ extraction, billAnalysisConfidence: "High", recommendationData: "Complete" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200, headers: { "content-type": "application/json" } }));
    const { container } = render(<SolarBillAnalyzer />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(["%PDF-1.7"], "bill.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Analyze Bill/i }));
    expect(await screen.findByDisplayValue("IESCO")).toBeTruthy();
    const provider = screen.getByDisplayValue("IESCO");
    await user.clear(provider);
    await user.type(provider, "Corrected IESCO");
    const firstMonth = screen.getAllByLabelText(/consumption in kWh/i)[0]!;
    await user.clear(firstMonth);
    await user.type(firstMonth, "450");
    await user.click(screen.getByRole("button", { name: /Compare Solar Systems/i }));
    expect(await screen.findByRole("heading", { name: /10.53 kWp On-Grid/i })).toBeTruthy();
    expect(screen.getByText(/Compare system architectures/i)).toBeTruthy();
    const calculateBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(calculateBody.provider).toBe("Corrected IESCO");
    expect(calculateBody.monthlyConsumption[0].kwh).toBe(450);
  });

  test("shows actionable extraction errors and keeps manual fallback available", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Bill extraction is temporarily unavailable. You can enter consumption manually." }), { status: 503, headers: { "content-type": "application/json" } }));
    const { container } = render(<SolarBillAnalyzer />);
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["%PDF"], "bill.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Analyze Bill/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/temporarily unavailable/i);
    expect((screen.getByRole("button", { name: /Enter Consumption Manually/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("requires a listed Pakistan city before calculation", async () => {
    const user = userEvent.setup();
    render(<SolarBillAnalyzer />);
    await user.click(screen.getByRole("button", { name: /Enter Consumption Manually/i }));
    await user.type(screen.getByLabelText(/Pakistan city/i), "Outside Pakistan");
    fireEvent.change(screen.getAllByLabelText(/consumption in kWh/i)[0]!, { target: { value: "500" } });
    await user.click(screen.getByRole("button", { name: /Compare Solar Systems/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/listed Pakistan city/i);
  });

  test("renders comparison, lead CTA, WhatsApp context, and battery refinement", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ extraction, billAnalysisConfidence: "High", recommendationData: "Complete" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(recommendation), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...recommendation, systems: { ...recommendation.systems, hybrid: { ...recommendation.systems.hybrid, batteryRange: { minimumKwh: 25.6, maximumKwh: 25.6, refined: true } } } }), { status: 200, headers: { "content-type": "application/json" } }));
    const { container } = render(<SolarBillAnalyzer />);
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["%PDF"], "bill.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /Analyze Bill/i }));
    await screen.findByDisplayValue("IESCO");
    await user.click(screen.getByRole("button", { name: /Compare Solar Systems/i }));
    await screen.findByText(/THREE PRACTICAL PATHS/i);
    expect(screen.getByRole("button", { name: /Choose Hybrid/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose Off-Grid/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Continue to quotation/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Discuss on WhatsApp/i }).getAttribute("href")).toContain("wa.me");
    await user.click(screen.getByRole("button", { name: /Update Hybrid Battery/i }));
    await waitFor(() => expect(screen.getAllByText("25.6 kWh").length).toBeGreaterThan(0));
  });
});

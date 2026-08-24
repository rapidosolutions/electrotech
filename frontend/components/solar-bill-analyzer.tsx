"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Check, FileText, MessageCircle, ShieldCheck, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { siteConfig } from "@/lib/site-config";
import {
  analyzerApiUrl,
  analyzerLeadMessage,
  batteryRangeLabel,
  createAnalyzerLeadContext,
  createTwelveMonthGrid,
  PAKISTAN_CITIES,
  saveAnalyzerLeadContext,
  summarizeConsumption,
  validateBillFile,
  type BillExtraction,
  type EditableMonth,
  type SolarRecommendationResult,
  type VerifiedSolarInput,
} from "@/lib/solar-analyzer";
import styles from "./solar-bill-analyzer.module.css";

type Stage = "upload" | "review" | "results";
type ApiError = { code?: string; message?: string };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits }).format(value);
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.message || "The request could not be completed.");
  return body;
}

function SystemCard({ system, selected, onSelect }: {
  system: SolarRecommendationResult["systems"][keyof SolarRecommendationResult["systems"]];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`${styles.systemCard} ${selected ? styles.systemCardSelected : ""}`}>
      <div className={styles.systemCardHead}>
        <div>
          <span>{system.architecture}</span>
          <h3>{formatNumber(system.actualInstalledKwp, 2)} kWp</h3>
        </div>
        {selected ? <span className={styles.selectedMark}><Check size={14} aria-hidden="true" /> Selected</span> : null}
      </div>
      <dl className={styles.compactSpecs}>
        <div><dt>Inverter</dt><dd>{formatNumber(system.inverterKw, 1)} kW</dd></div>
        <div><dt>Panels</dt><dd>{system.panelCount}</dd></div>
        <div><dt>Coverage</dt><dd>{formatNumber(system.matchedConsumptionCoveragePercent)}%</dd></div>
        <div><dt>Battery</dt><dd>{batteryRangeLabel(system.batteryRange) ?? "Not included"}</dd></div>
      </dl>
      <p>{system.qualification}</p>
      <button type="button" className={styles.cardSelect} onClick={onSelect} aria-pressed={selected}>
        {selected ? "Selected for proposal" : `Choose ${system.architecture}`}
      </button>
    </article>
  );
}

export function SolarBillAnalyzer() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("");
  const [city, setCity] = useState("");
  const [connectionType, setConnectionType] = useState("");
  const [phase, setPhase] = useState<"" | "single" | "three">("");
  const [sanctionedLoad, setSanctionedLoad] = useState("");
  const [months, setMonths] = useState<EditableMonth[]>(() => createTwelveMonthGrid());
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [currentReading, setCurrentReading] = useState<number | null>(null);
  const [billConfidence, setBillConfidence] = useState<"High" | "Medium" | "Low">("Low");
  const [recommendationData, setRecommendationData] = useState<"Complete" | "Incomplete">("Incomplete");
  const [locationWasMissing, setLocationWasMissing] = useState(false);
  const [result, setResult] = useState<SolarRecommendationResult | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<"onGrid" | "hybrid" | "offGrid">("onGrid");
  const [backupLevel, setBackupLevel] = useState<"essential" | "most" | "entire">("essential");
  const [backupHours, setBackupHours] = useState<2 | 4 | 6 | 8>(4);
  const [knownBackupLoad, setKnownBackupLoad] = useState("");

  const summary = useMemo(() => summarizeConsumption(months), [months]);

  function chooseFile(nextFile: File | null) {
    setError("");
    if (!nextFile) return;
    const validationError = validateBillFile(nextFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      return;
    }
    setFile(nextFile);
  }

  function applyExtraction(extraction: BillExtraction, confidence: "High" | "Medium" | "Low", completeness: "Complete" | "Incomplete") {
    setProvider(extraction.provider ?? "");
    setCity(extraction.city ?? "");
    setConnectionType(extraction.connectionType ?? "");
    setPhase(extraction.phase ?? "");
    setSanctionedLoad(extraction.sanctionedLoadKw === null ? "" : String(extraction.sanctionedLoadKw));
    setMonths(createTwelveMonthGrid(extraction.monthlyConsumption));
    setUncertainFields(extraction.uncertainFields);
    setCurrentReading(extraction.currentMonthConsumptionKwh);
    setBillConfidence(confidence);
    setRecommendationData(completeness);
    setLocationWasMissing(!extraction.city);
    setStage("review");
  }

  async function extractBill() {
    if (!file) {
      setError("Choose a bill before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const form = new FormData();
      form.set("bill", file);
      const response = await fetch(analyzerApiUrl("/api/solar-analyzer/extract"), { method: "POST", body: form, signal: controller.signal });
      const body = await readJson<{ extraction: BillExtraction; billAnalysisConfidence: "High" | "Medium" | "Low"; recommendationData: "Complete" | "Incomplete" }>(response);
      applyExtraction(body.extraction, body.billAnalysisConfidence, body.recommendationData);
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError"
        ? "Bill analysis timed out. Retry, upload the original PDF, or enter consumption manually."
        : caught instanceof Error ? caught.message : "The bill could not be analyzed.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  function startManualEntry() {
    setFile(null);
    setProvider("");
    setCity("");
    setConnectionType("");
    setPhase("");
    setSanctionedLoad("");
    setMonths(createTwelveMonthGrid());
    setUncertainFields([]);
    setCurrentReading(null);
    setBillConfidence("Low");
    setRecommendationData("Incomplete");
    setLocationWasMissing(true);
    setError("");
    setStage("review");
  }

  function updateMonth(index: number, kwh: string) {
    if (kwh !== "" && (!/^\d*(\.\d{0,2})?$/.test(kwh) || Number(kwh) > 10_000_000)) return;
    setMonths((current) => current.map((month, monthIndex) => monthIndex === index
      ? { ...month, kwh, confidence: kwh.trim() ? "high" : "low" }
      : month));
  }

  function verifiedPayload(withBattery = false): VerifiedSolarInput | null {
    const matchedCity = PAKISTAN_CITIES.find((item) => item.toLowerCase() === city.trim().toLowerCase());
    if (!matchedCity) {
      setError("Choose a listed Pakistan city before calculating.");
      return null;
    }
    if (!summary) {
      setError("Enter at least one readable monthly consumption value.");
      return null;
    }
    const load = sanctionedLoad.trim() === "" ? null : Number(sanctionedLoad);
    const backupLoad = knownBackupLoad.trim() === "" ? null : Number(knownBackupLoad);
    if ((load !== null && (!Number.isFinite(load) || load < 0)) || (backupLoad !== null && (!Number.isFinite(backupLoad) || backupLoad <= 0))) {
      setError("Review the load values before calculating.");
      return null;
    }
    return {
      provider: provider.trim() || null,
      city: matchedCity,
      connectionType: connectionType.trim() || null,
      phase: phase || null,
      sanctionedLoadKw: load,
      monthlyConsumption: months.map((month) => ({
        year: month.year,
        month: month.month,
        kwh: month.kwh.trim() === "" ? null : Number(month.kwh),
        confidence: month.kwh.trim() === "" ? "low" : month.confidence,
      })),
      ...(withBattery ? { backupPreference: { level: backupLevel, durationHours: backupHours, backupLoadKw: backupLoad } } : {}),
    };
  }

  async function calculate(withBattery = false) {
    const payload = verifiedPayload(withBattery);
    if (!payload) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(analyzerApiUrl("/api/solar-analyzer/calculate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const recommendation = await readJson<SolarRecommendationResult>(response);
      setResult(recommendation);
      setBillConfidence(recommendation.dataQuality.billAnalysisConfidence);
      setRecommendationData(recommendation.dataQuality.recommendationData);
      setSelectedSystem(withBattery ? "hybrid" : "onGrid");
      setStage("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError"
        ? "The calculation timed out. Please retry."
        : caught instanceof Error ? caught.message : "The recommendation could not be calculated.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  function requestProposal() {
    if (!result) return;
    saveAnalyzerLeadContext(createAnalyzerLeadContext(result, selectedSystem));
    window.location.href = "/?source=solar_bill_analyzer#contact";
  }

  const selectedResult = result?.systems[selectedSystem];
  const whatsappContext = result && selectedResult ? createAnalyzerLeadContext(result, selectedSystem) : null;
  const whatsappHref = whatsappContext
    ? `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(`Hello, I used the Electrotech Solar Bill Analyzer.\n\n${analyzerLeadMessage(whatsappContext)}`)}`
    : siteConfig.whatsappHref;

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#analyzer-main">Skip to analyzer</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Electro Tech home">
          <Image src="/logos/electrotech-horizontal.png" width={407} height={112} alt="Electro Tech — Electrical & Solar Solutions" priority />
        </Link>
        <Link href="/" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" /> Back to website</Link>
      </header>

      <main id="analyzer-main" className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>SOLAR ENGINEERING TOOL</p>
          <h1>Turn your electricity usage into a practical solar starting point.</h1>
          <p>Upload a bill or enter monthly consumption manually. You verify every reading before Electrotech’s deterministic sizing model compares On-Grid, Hybrid, and Off-Grid options.</p>
        </div>

        <ol className={styles.steps} aria-label="Analyzer progress">
          {[["upload", "1", "Bill"], ["review", "2", "Verify"], ["results", "3", "Recommendation"]].map(([key, number, label]) => {
            const order = { upload: 0, review: 1, results: 2 } as const;
            const active = order[stage] >= order[key as Stage];
            return <li key={key} className={active ? styles.stepActive : ""}><span>{active && order[stage] > order[key as Stage] ? <Check size={13} /> : number}</span>{label}</li>;
          })}
        </ol>

        {stage === "upload" ? (
          <section className={styles.workspace} aria-labelledby="upload-title">
            <div className={styles.workspaceIntro}>
              <span>01 / BILL INPUT</span>
              <h2 id="upload-title">Upload your electricity bill</h2>
              <p>A clear original PDF usually provides the most reliable month-by-month reading.</p>
            </div>
            <div className={styles.uploadPanel}>
              <div
                className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""} ${file ? styles.dropzoneReady : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => { event.preventDefault(); setDragActive(false); chooseFile(event.dataTransfer.files[0] ?? null); }}
              >
                <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
                <span className={styles.uploadIcon}>{file ? <FileText size={22} /> : <Upload size={22} />}</span>
                {file ? <><strong>{file.name}</strong><small>{formatNumber(file.size / 1024 / 1024, 2)} MB · ready to analyze</small></> : <><strong>Drop your bill here</strong><small>PDF, JPG, JPEG or PNG · maximum 10 MB</small></>}
                <button type="button" onClick={() => fileInput.current?.click()}>{file ? "Choose another file" : "Choose a file"}</button>
              </div>
              <p className={styles.privacy}><ShieldCheck size={16} aria-hidden="true" /> Your bill is used only to read electricity-consumption information and is not stored by Electrotech after analysis.</p>
              {error ? <div className={styles.error} role="alert"><AlertCircle size={17} /> <span>{error}</span></div> : null}
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="button" disabled={!file || busy} onClick={extractBill}>
                  {busy ? "Reading bill…" : "Analyze Bill"} {!busy ? <ArrowRight size={16} /> : null}
                </button>
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={startManualEntry}>Enter Consumption Manually</button>
              </div>
              {error ? <p className={styles.errorHelp}>You can retry with a clearer image, upload the original PDF, or continue manually.</p> : null}
            </div>
          </section>
        ) : null}

        {stage === "review" ? (
          <section className={styles.workspace} aria-labelledby="review-title">
            <div className={styles.workspaceIntro}>
              <span>02 / VERIFY DATA</span>
              <h2 id="review-title">Check the readings before sizing</h2>
              <p>Nothing is silently filled in. Missing months stay blank until you add a value.</p>
              <div className={styles.qualityLine}><b>Bill Analysis Confidence: {billConfidence}</b><b>Recommendation Data: {recommendationData}</b></div>
            </div>
            <div className={styles.reviewPanel}>
              {locationWasMissing ? <div className={styles.locationQuestion}>Where will the solar system be installed?</div> : null}
              <div className={styles.formGrid}>
                <label>Provider<input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="e.g. IESCO" /></label>
                <label className={locationWasMissing && !city ? styles.fieldNeedsReview : ""}>Pakistan city *<input list="pakistan-cities" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Search city" autoComplete="address-level2" /></label>
                <datalist id="pakistan-cities">{PAKISTAN_CITIES.map((item) => <option key={item} value={item} />)}</datalist>
                <label>Connection type<input value={connectionType} onChange={(event) => setConnectionType(event.target.value)} placeholder="If printed" /></label>
                <label>Phase<select value={phase} onChange={(event) => setPhase(event.target.value as typeof phase)}><option value="">Not printed</option><option value="single">Single phase</option><option value="three">Three phase</option></select></label>
                <label>Sanctioned load (kW)<input inputMode="decimal" value={sanctionedLoad} onChange={(event) => setSanctionedLoad(event.target.value)} placeholder="If printed" /></label>
              </div>

              {currentReading !== null ? <p className={styles.extractedHint}>The bill also shows a current consumption reading of <b>{formatNumber(currentReading)} kWh</b>. Confirm it against the correct month below before calculating.</p> : null}
              {uncertainFields.length ? <p className={styles.extractedHint}>Please review uncertain bill fields: {uncertainFields.join(", ")}.</p> : null}

              <div className={styles.monthHeading}><div><h3>Monthly consumption</h3><p>Enter bill units only when they represent kWh.</p></div><span>{summary?.readableMonths ?? 0} / 12 months</span></div>
              <div className={styles.monthGrid}>
                {months.map((month, index) => (
                  <label key={`${month.year}-${month.month}`} className={!month.kwh || month.confidence !== "high" ? styles.monthNeedsReview : ""}>
                    <span>{MONTH_NAMES[month.month - 1]} {month.year}</span>
                    <input aria-label={`${MONTH_NAMES[month.month - 1]} ${month.year} consumption in kWh`} inputMode="decimal" value={month.kwh} onChange={(event) => updateMonth(index, event.target.value)} placeholder="Missing" />
                    <small>kWh</small>
                  </label>
                ))}
              </div>

              {summary ? (
                <dl className={styles.summaryStrip}>
                  <div><dt>{summary.estimated ? "Estimated annual*" : "Annual consumption"}</dt><dd>{formatNumber(summary.annualConsumption)} kWh</dd></div>
                  <div><dt>Monthly average</dt><dd>{formatNumber(summary.averageMonthly)} kWh</dd></div>
                  <div><dt>Daily average</dt><dd>{formatNumber(summary.averageDaily, 1)} kWh</dd></div>
                  <div><dt>Highest reading</dt><dd>{MONTH_NAMES[summary.highest.month - 1]} · {formatNumber(summary.highest.value)}</dd></div>
                  <div><dt>Lowest reading</dt><dd>{MONTH_NAMES[summary.lowest.month - 1]} · {formatNumber(summary.lowest.value)}</dd></div>
                </dl>
              ) : null}
              {summary?.estimated ? <p className={styles.estimateNote}>*For preliminary sizing only, the observed monthly average is annualized. Missing monthly values remain visibly missing and annual surplus/shortfall is not claimed.</p> : null}
              {error ? <div className={styles.error} role="alert"><AlertCircle size={17} /> <span>{error}</span></div> : null}
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => calculate(false)}>{busy ? "Calculating…" : "Compare Solar Systems"} {!busy ? <ArrowRight size={16} /> : null}</button>
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setStage("upload")}><ArrowLeft size={15} /> Back to upload</button>
              </div>
            </div>
          </section>
        ) : null}

        {stage === "results" && result && selectedResult ? (
          <section className={styles.results} aria-labelledby="result-title">
            <div className={styles.bestMatch}>
              <div>
                <span>{result.bestMatch.architecture === "On-Grid" ? "BEST PRELIMINARY BILL-REDUCTION MATCH" : "BEST PRELIMINARY BACKUP-CAPABLE MATCH"}</span>
                <h2 id="result-title">{formatNumber(result.systems.onGrid.actualInstalledKwp, 2)} kWp {result.bestMatch.architecture}</h2>
                <p>{result.bestMatch.reason}</p>
              </div>
              <div className={styles.bestMatchMetric}><strong>{formatNumber(result.systems.onGrid.matchedConsumptionCoveragePercent)}%</strong><span>matched-consumption coverage across verified months</span></div>
            </div>

            <div className={styles.resultColumns}>
              <section className={styles.resultSection}>
                <span className={styles.resultLabel}>EQUIPMENT</span>
                <dl className={styles.equipmentGrid}>
                  <div><dt>Installed PV</dt><dd>{formatNumber(selectedResult.actualInstalledKwp, 2)} kWp</dd></div>
                  <div><dt>Inverter</dt><dd>{formatNumber(selectedResult.inverterKw, 1)} kW</dd></div>
                  <div><dt>Panels</dt><dd>{selectedResult.panelCount} × {result.assumptions.panelWattage} W</dd></div>
                  <div><dt>Battery</dt><dd>{batteryRangeLabel(selectedResult.batteryRange) ?? "Not included"}</dd></div>
                </dl>
              </section>
              <section className={styles.resultSection}>
                <span className={styles.resultLabel}>BILL ANALYSIS</span>
                <dl className={styles.equipmentGrid}>
                  <div><dt>{result.consumption.annualConsumptionEstimated ? "Estimated annual" : "Annual consumption"}</dt><dd>{formatNumber(result.consumption.annualConsumptionKwh)} kWh</dd></div>
                  <div><dt>Monthly average</dt><dd>{formatNumber(result.consumption.averageMonthlyKwh)} kWh</dd></div>
                  <div><dt>Daily average</dt><dd>{formatNumber(result.consumption.averageDailyKwh, 1)} kWh</dd></div>
                  <div><dt>Highest month</dt><dd>{result.consumption.highestMonth.label} · {formatNumber(result.consumption.highestMonth.kwh)} kWh</dd></div>
                  <div><dt>Lowest month</dt><dd>{result.consumption.lowestMonth.label} · {formatNumber(result.consumption.lowestMonth.kwh)} kWh</dd></div>
                </dl>
              </section>
            </div>

            <section className={styles.energySection}>
              <div className={styles.sectionTitle}><div><span className={styles.resultLabel}>ENERGY ANALYSIS</span><h2>Seasonal generation, without assumed export credits.</h2></div><dl><div><dt>Annual generation</dt><dd>{formatNumber(selectedResult.annualGenerationKwh)} kWh</dd></div><div><dt>Verified-month coverage</dt><dd>{formatNumber(selectedResult.matchedConsumptionCoveragePercent)}%</dd></div><div><dt>Annual surplus</dt><dd>{selectedResult.annualSurplusKwh === null ? "Not claimed" : `${formatNumber(selectedResult.annualSurplusKwh)} kWh`}</dd></div><div><dt>Annual shortfall</dt><dd>{selectedResult.annualShortfallKwh === null ? "Not claimed" : `${formatNumber(selectedResult.annualShortfallKwh)} kWh`}</dd></div></dl></div>
              <div className={styles.monthlyTable} role="table" aria-label="Monthly generation and consumption">
                <div className={styles.tableHead} role="row"><span>Month</span><span>Consumption</span><span>Generation</span><span>Difference</span></div>
                {selectedResult.monthlySimulation.map((month) => {
                  const difference = month.consumptionKwh === null ? null : month.generationKwh - month.consumptionKwh;
                  return <div key={month.month} className={styles.tableRow} role="row"><b>{month.monthName}</b><span>{month.consumptionKwh === null ? "Missing" : `${formatNumber(month.consumptionKwh)} kWh`}</span><span>{formatNumber(month.generationKwh)} kWh</span><span className={difference === null ? styles.muted : difference >= 0 ? styles.surplus : styles.shortfall}>{difference === null ? "Not compared" : `${difference >= 0 ? "+" : ""}${formatNumber(difference)} kWh`}</span></div>;
                })}
              </div>
              <p className={styles.seasonNote}>Highest modeled surplus: {selectedResult.highestSurplusMonth ?? "none in verified months"}. Highest modeled shortfall: {selectedResult.highestShortfallMonth ?? "none in verified months"}.</p>
            </section>

            <section className={styles.comparison}>
              <div className={styles.sectionTitle}><div><span className={styles.resultLabel}>THREE PRACTICAL PATHS</span><h2>Compare system architectures</h2></div><p>A bill establishes energy use, not backup preference. Choose the architecture you want Electrotech to assess in detail.</p></div>
              <div className={styles.systemGrid}>
                <SystemCard system={result.systems.onGrid} selected={selectedSystem === "onGrid"} onSelect={() => setSelectedSystem("onGrid")} />
                <SystemCard system={result.systems.hybrid} selected={selectedSystem === "hybrid"} onSelect={() => setSelectedSystem("hybrid")} />
                <SystemCard system={result.systems.offGrid} selected={selectedSystem === "offGrid"} onSelect={() => setSelectedSystem("offGrid")} />
              </div>
            </section>

            <section className={styles.batteryRefinement}>
              <div><span className={styles.resultLabel}>OPTIONAL</span><h2>Refine Battery Estimate</h2><p>Use only your stated backup requirement. Monthly bill totals do not identify backup loads or duration.</p></div>
              <div className={styles.refineForm}>
                <fieldset><legend>Backup level</legend><div className={styles.choiceRow}>{[["essential", "Essential loads"], ["most", "Most property loads"], ["entire", "Entire property"]].map(([value, label]) => <button type="button" key={value} className={backupLevel === value ? styles.choiceActive : ""} aria-pressed={backupLevel === value} onClick={() => setBackupLevel(value as typeof backupLevel)}>{label}</button>)}</div></fieldset>
                <fieldset><legend>Backup duration</legend><div className={styles.choiceRow}>{[2, 4, 6, 8].map((hours) => <button type="button" key={hours} className={backupHours === hours ? styles.choiceActive : ""} aria-pressed={backupHours === hours} onClick={() => setBackupHours(hours as typeof backupHours)}>{hours === 8 ? "8+ hours" : `${hours} hours`}</button>)}</div></fieldset>
                <label>I know my backup load (optional, kW)<input inputMode="decimal" value={knownBackupLoad} onChange={(event) => setKnownBackupLoad(event.target.value)} placeholder="e.g. 5" /></label>
                {error ? <div className={styles.error} role="alert"><AlertCircle size={17} /> <span>{error}</span></div> : null}
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => calculate(true)}>{busy ? "Refining…" : "Update Hybrid Battery"}</button>
              </div>
            </section>

            <section className={styles.assumptions}>
              <div><span>Profile</span><b>{result.location.profileCity}{result.location.regionalFallbackUsed ? " · conservative regional mapping" : ""}</b></div>
              <div><span>Panel basis</span><b>{result.assumptions.panelWattage} W</b></div>
              <div><span>Performance factor</span><b>{formatNumber(result.assumptions.performanceRatio * 100)}%</b></div>
              <div><span>Data</span><b>{result.dataQuality.recommendationData} · {result.dataQuality.billAnalysisConfidence} confidence</b></div>
            </section>

            <section className={styles.proposal}>
              <div><span>FROM PRELIMINARY TO PROJECT-READY</span><h2>Get an Exact Solar Proposal</h2><p>This result gives Electrotech a stronger starting point. A site assessment confirms roof, shading, load profile, equipment, protection, and utility requirements.</p></div>
              <div className={styles.proposalActions}>
                <button type="button" className={styles.accentButton} onClick={requestProposal}>Continue to quotation <ArrowRight size={16} /></button>
                <a className={styles.whatsappButton} href={whatsappHref} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Discuss on WhatsApp</a>
                <button type="button" className={styles.textButton} onClick={() => setStage("review")}><ArrowLeft size={15} /> Edit verified data</button>
              </div>
            </section>

            <p className={styles.disclaimer}>This is a preliminary solar recommendation based on your verified electricity consumption and location. Final system design may vary after site assessment, roof/shading review, electrical load analysis, equipment selection and applicable utility requirements. Battery and Off-Grid designs require a detailed backup-load assessment.</p>
          </section>
        ) : null}
      </main>
    </div>
  );
}

"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  Mail,
  MessageCircle,
  Phone,
  Waves,
  Sun,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";
import { analyzerLeadMessage, consumeAnalyzerLeadContext } from "@/lib/solar-analyzer";
import { QuoteInput, quoteSchema } from "@/lib/validation";

const navItems = [
  ["About", "#about"],
  ["Services", "#services"],
  ["Projects", "#projects"],
  ["Process", "#process"],
  ["Contact", "#contact"],
] as const;

const solarContent = {
  Hybrid: {
    eyebrow: "Flexible continuity",
    description: "Solar, battery storage, and the grid work seamlessly together in one adaptable configuration.",
    battery: true,
    grid: true,
  },
  "On-Grid": {
    eyebrow: "Direct connection",
    description: "Solar generation directly offsets grid electricity during peak daytime consumption hours.",
    battery: false,
    grid: true,
  },
  "Off-Grid": {
    eyebrow: "Independent supply",
    description: "Solar generation and dedicated battery storage support the property without any grid connection.",
    battery: true,
    grid: false,
  },
} as const;

type SolarType = keyof typeof solarContent;

const billRanges = [
  "Under PKR 25,000",
  "PKR 25,000–50,000",
  "PKR 50,000–100,000",
  "PKR 100,000+",
  "Prefer not to say",
] as const;

const technologies = [
  { name: "Inverex", src: "/brands/inverex.png" },
  { name: "Solis", src: "/brands/solis-light.png" },
  { name: "Tesla Industries", src: "/brands/tesla-light.png" },
  { name: "Growatt", src: "/brands/growatt-light.png" },
  { name: "CoreTECH", src: "/brands/coretech.png" },
  { name: "itel", src: "/brands/itel.svg" },
] as const;

const footerCompany = [
  ["About", "#about"],
  ["Projects", "#projects"],
  ["Process", "#process"],
  ["Contact", "#contact"],
] as const;

const footerSolutions = [
  ["Solar Systems", "#solar"],
  ["Solar Structures", "#services"],
  ["Electrical Works", "#services"],
  ["Security Systems", "#services"],
] as const;

function LinkIcon({ direction = "up-right" }: { direction?: "up-right" | "right" }) {
  const Icon = direction === "right" ? ArrowRight : ArrowUpRight;
  return <Icon className="link-icon" size={16} strokeWidth={1.8} aria-hidden="true" />;
}

function SectionIntro({
  label,
  title,
  copy,
}: {
  label: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="section-intro">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </div>
  );
}

function EnergyDiagram({ active }: { active: SolarType }) {
  const details = solarContent[active];
  return (
    <div className="energy-diagram" aria-label={`${active} solar energy flow`}>
      <div className="energy-node sun-node">
        <span className="sun-shape"><Sun size={20} strokeWidth={1.8} /></span>
        <b>Sun</b>
      </div>
      <span className="flow-line vertical active" aria-hidden="true" />
      <div className="energy-node panel-node">
        <span className="panel-shape"><i /><i /><i /><i /></span>
        <b>Solar panels</b>
      </div>
      <span className="flow-line vertical active" aria-hidden="true" />
      <div className="energy-node inverter-node">
        <span className="inverter-shape"><Waves size={22} strokeWidth={1.8} aria-hidden="true" /></span>
        <b>Inverter</b>
      </div>
      <span className="flow-line vertical active" aria-hidden="true" />
      <div className="energy-node property-node">
        <span className="house-shape"><i /></span>
        <b>Property</b>
      </div>
      <div className="branch-lines" aria-hidden="true">
        <span className={`branch left ${details.battery ? "active" : "inactive"}`} />
        <span className={`branch right ${details.grid ? "active" : "inactive"}`} />
      </div>
      <div className="energy-branches">
        <div className={`energy-node compact ${details.battery ? "enabled" : "disabled"}`}>
          <span className="battery-shape"><i /></span>
          <b>Battery</b>
        </div>
        <div className={`energy-node compact ${details.grid ? "enabled" : "disabled"}`}>
          <span className="grid-shape"><i /><i /><i /></span>
          <b>Grid</b>
        </div>
      </div>
    </div>
  );
}

export function ElectroTechSite() {
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [solarType, setSolarType] = useState<SolarType>("Hybrid");
  const [propertyType, setPropertyType] = useState("Home");
  const [startingBill, setStartingBill] = useState<(typeof billRanges)[number]>("PKR 25,000–50,000");
  const [startingSystem, setStartingSystem] = useState<SolarType | "Not Sure">("Hybrid");
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");
  const [serverMessage, setServerMessage] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const lastScrollY = useRef(0);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      city: "",
      service: "Solar Energy",
      email: "",
      company: "",
      propertyType: "Home",
      systemType: "Hybrid",
      requiredCapacity: "",
      monthlyBillRange: "PKR 25,000–50,000",
      message: "",
      website: "",
    },
  });

  const selectedService = useWatch({ control, name: "service" });

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 20);

      if (currentScrollY <= 40) {
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current + 6) {
        // Scrolling down -> hide header
        setHeaderVisible(false);
      } else if (currentScrollY < lastScrollY.current - 6) {
        // Scrolling up -> show header
        setHeaderVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("source") !== "solar_bill_analyzer") return;
    const context = consumeAnalyzerLeadContext();
    if (!context) return;
    setValue("service", "Solar Energy", { shouldValidate: true });
    setValue("systemType", context.systemType, { shouldValidate: true });
    setValue("city", context.city, { shouldValidate: true });
    setValue("requiredCapacity", `${context.actualInstalledKwp} kWp preliminary`, { shouldValidate: true });
    setValue("message", analyzerLeadMessage(context), { shouldValidate: true });
  }, [setValue]);

  function scrollToSection(targetId: string) {
    const id = targetId.replace(/^#/, "");
    const element = document.getElementById(id);
    if (element) {
      const offset = 40;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }

  function continueToQuote() {
    setValue("service", "Solar Energy", { shouldValidate: true });
    setValue("propertyType", propertyType as "Home" | "Business" | "Institution" | "Other", { shouldValidate: true });
    setValue("monthlyBillRange", startingBill, { shouldValidate: true });
    setValue("systemType", startingSystem, { shouldValidate: true });
    scrollToSection("contact");
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("#fullName");
      if (input) {
        input.focus({ preventScroll: true });
      }
    }, reducedMotion ? 0 : 450);
  }

  async function submitQuote(values: QuoteInput) {
    setSubmitState("idle");
    setServerMessage("");
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Submission failed");
      setSubmitState("success");
      reset();
    } catch (error) {
      setSubmitState("error");
      setServerMessage(error instanceof Error ? error.message : "We couldn't submit your enquiry. Please try again.");
    }
  }

  const motionProps = reducedMotion
    ? {}
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } };

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className={`site-header ${scrolled ? "is-scrolled" : ""} ${!headerVisible && !menuOpen ? "is-hidden" : ""} ${menuOpen ? "has-open-menu" : ""}`}>
        <div className="header-inner">
          <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }} aria-label="Electro Tech home">
            <Image src="/logos/electrotech-horizontal.png" width={407} height={112} alt="Electro Tech — Electrical & Solar Solutions" priority />
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map(([label, href]) => (
              <a key={href} href={href} onClick={(e) => { e.preventDefault(); scrollToSection(href); }}>
                {label}
              </a>
            ))}
          </nav>
          <a className="button button-dark header-pill-cta" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>
            Request a Solar Quote <ArrowUpRight size={15} className="link-icon" aria-hidden="true" />
          </a>
          <button ref={menuButtonRef} className="menu-button" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen((open) => !open)}>
            <span /><span />
          </button>
        </div>
        <AnimatePresence>
          {menuOpen ? (
            <motion.nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation" initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {navItems.map(([label, href]) => (
                <a key={href} href={href} onClick={() => { setMenuOpen(false); scrollToSection(href); }}>
                  {label}<LinkIcon />
                </a>
              ))}
              <a className="button button-dark mobile-cta" href="#contact" onClick={(e) => { e.preventDefault(); setMenuOpen(false); scrollToSection("contact"); }}>
                Request a Solar Quote <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <main id="main-content">
        {/* HERO SECTION (16:9 Architectural Composition) */}
        <section id="home" className="hero-shell section-shell" aria-label="Introduction">
          <div className="hero-canvas">
            <div className="hero-visual-bg">
              <Image
                src="/images/hero-solar-architectural.jpg"
                alt="Modern solar-powered residence with sleek rooftop photovoltaic panels"
                fill
                priority
                sizes="(max-width: 1440px) 100vw, 1380px"
                className="hero-image-cover"
              />
              <div className="hero-gradient-overlay" aria-hidden="true" />
            </div>

            {/* Upper-left Hero Content Overlay */}
            <div className="hero-overlay-content">
              <motion.h1 className="hero-headline" {...motionProps} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                Powering Progress<br />
                With Smarter Energy.
              </motion.h1>

              <motion.p className="hero-description" {...motionProps} transition={{ duration: 0.55, delay: reducedMotion ? 0 : 0.08 }}>
                Complete solar and electrical solutions engineered for homes, businesses, and institutions.
              </motion.p>

              <motion.div className="hero-actions-wrap" {...motionProps} transition={{ duration: 0.5, delay: reducedMotion ? 0 : 0.16 }}>
                <a className="button hero-white-pill" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>
                  Get a Solar Quote <ArrowRight size={15} className="link-icon" aria-hidden="true" />
                </a>
              </motion.div>
            </div>

            {/* Bottom-left Floating Credibility Card */}
            <motion.div
              className="hero-credibility-card"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="credibility-header">
                <span className="credibility-icon" aria-hidden="true"><Sun size={15} strokeWidth={2.2} /></span>
                <strong>5 kW–1 MW</strong>
              </div>
              <span className="credibility-label">Solar System Capacity</span>
              <span className="credibility-sub">On-Grid · Hybrid · Off-Grid</span>
            </motion.div>
          </div>
        </section>

        {/* FACTS METRIC STRIP */}
        <section className="facts section-shell" aria-label="Electro Tech key facts">
          <div><strong>Since 2019</strong><p>Established electrical and solar engineering solutions.</p></div>
          <div><strong>5 kW–1 MW</strong><p>Scalable solar installations for residential & commercial.</p></div>
          <div><strong>On-Grid / Hybrid / Off-Grid</strong><p>Configurations customized for energy independence.</p></div>
        </section>

        {/* ABOUT SECTION */}
        <section id="about" className="about section-shell section-pad">
          <div className="about-copy">
            <SectionIntro label="ABOUT ELECTRO TECH" title="Energy solutions built around real requirements." />
            <p>Since 2019, Electro Tech has provided integrated solar and electrical solutions for homes, businesses, and institutions.</p>
            <p className="about-focus">Solar is our <span>primary focus.</span></p>
            <ul className="about-points">
              <li><b>Since 2019</b><span>Established track record</span></li>
              <li><b>Solar + Electrical</b><span>Integrated engineering</span></li>
              <li><b>5 kW–1 MW</b><span>Scalable system range</span></li>
              <li><b>Homes / Businesses / Institutions</b><span>Project types</span></li>
            </ul>
            <div className="about-tag-wrap">
              <span className="about-tag">Measured. Installed. Supported.</span>
            </div>
          </div>
          <div className="about-images">
            <div className="about-image-primary">
              <Image src="/images/solar-technician.jpg" alt="Solar technician completing a high-precision rooftop installation" fill sizes="(max-width: 800px) 90vw, 42vw" />
            </div>
            <div className="about-image-secondary">
              <Image src="/images/electrical-panel.jpg" alt="Electrician working on an industrial distribution panel" fill sizes="(max-width: 800px) 55vw, 22vw" />
            </div>
          </div>
        </section>

        {/* SOLAR INTERACTIVE EXPLAINER */}
        <section id="solar" className="solar-section section-pad">
          <div className="section-shell">
            <SectionIntro
              label="SYSTEM ARCHITECTURE"
              title="Choose the solar system that fits your energy needs."
              copy="Explore how each configuration connects solar generation to your property."
            />
            <div className="solar-layout">
              <div className="solar-controls">
                <div className="solar-tabs" role="tablist" aria-label="Solar system type">
                  {(Object.keys(solarContent) as SolarType[]).map((type) => (
                    <button key={type} type="button" role="tab" aria-selected={solarType === type} onClick={() => setSolarType(type)}>
                      {type}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={solarType} className="solar-description" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <p className="eyebrow">{solarContent[solarType].eyebrow}</p>
                    <h3>{solarType} Solar System</h3>
                    <p>{solarContent[solarType].description}</p>
                    <a className="text-link" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>Discuss this system <LinkIcon /></a>
                  </motion.div>
                </AnimatePresence>
              </div>
              <EnergyDiagram active={solarType} />
            </div>
          </div>
        </section>

        {/* SOLAR BILL ANALYZER CTA */}
        <section className="analyzer-cta section-shell" aria-labelledby="analyzer-cta-title">
          <div>
            <p className="eyebrow">CONSUMPTION-BASED STARTING POINT</p>
            <h2 id="analyzer-cta-title">Not sure which system fits your usage?</h2>
            <p>Upload your electricity bill and get a preliminary solar recommendation based on your actual consumption.</p>
          </div>
          <a className="button button-primary" href="/solar-bill-analyzer">Analyze My Electricity Bill <LinkIcon direction="right" /></a>
        </section>

        {/* SOLAR QUESTIONNAIRE */}
        <section id="solar-start" className="starting section-shell section-pad">
          <div className="starting-heading">
            <SectionIntro
              label="A SIMPLE FIRST STEP"
              title="Find your solar starting point."
              copy="Share a few project details so Electro Tech can better understand your requirements."
            />
          </div>
          <div className="starting-form" aria-label="Solar starting point questionnaire">
            <fieldset>
              <legend>1. Property type</legend>
              <div className="choice-row">
                {["Home", "Business", "Institution", "Other"].map((value) => (
                  <button key={value} type="button" className={propertyType === value ? "active" : ""} onClick={() => setPropertyType(value)} aria-pressed={propertyType === value}>
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              2. Monthly electricity bill
              <select value={startingBill} onChange={(event) => setStartingBill(event.target.value as (typeof billRanges)[number])}>
                {billRanges.map((range) => (
                  <option key={range}>{range}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>3. System preference</legend>
              <div className="choice-row">
                {["On-Grid", "Hybrid", "Off-Grid", "Not Sure"].map((value) => (
                  <button key={value} type="button" className={startingSystem === value ? "active" : ""} onClick={() => setStartingSystem(value as SolarType | "Not Sure")} aria-pressed={startingSystem === value}>
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="button button-primary starting-submit" type="button" onClick={continueToQuote}>
              Continue to Solar Quote <LinkIcon direction="right" />
            </button>
          </div>
        </section>

        {/* SERVICES SECTION (Section 2 - 3-Card Presentation) */}
        <section id="services" className="services-section section-shell section-pad">
          <SectionIntro
            label="OUR SOLUTIONS"
            title="Complete Energy & Electrical Solutions"
            copy="Integrated solar systems, precision electrical panels, structural mounting, and surveillance infrastructure."
          />
          <div className="services-presentation">
            {/* Card 1 — Dominant Solar Systems */}
            <article className="service-feature-card dominant-card">
              <div className="service-feature-visual">
                <Image src="/images/solar-rooftop.jpg" alt="Commercial solar panel installation" fill sizes="(max-width: 900px) 100vw, 62vw" />
                <span className="service-badge">PRIMARY SOLUTION</span>
              </div>
              <div className="service-feature-body">
                <div className="service-header-row">
                  <span className="service-number">01</span>
                  <h3>Solar Systems</h3>
                </div>
                <p className="service-desc">Complete rooftop and ground-mounted solar energy systems engineered for maximum yield, long-term durability, and rapid return on investment.</p>
                <ul className="service-spec-list">
                  <li><Zap size={14} aria-hidden="true" /> On-Grid Direct Connection</li>
                  <li><Zap size={14} aria-hidden="true" /> Hybrid Battery Storage</li>
                  <li><Zap size={14} aria-hidden="true" /> Off-Grid Independent Supply</li>
                  <li><Zap size={14} aria-hidden="true" /> 5 kW–1 MW Capacity</li>
                </ul>
                <div className="service-card-action">
                  <a className="button button-outline" href="#solar" onClick={(e) => { e.preventDefault(); scrollToSection("solar"); }}>Explore Solar Systems <LinkIcon /></a>
                </div>
              </div>
            </article>

            {/* Card 2 — Solar Structures & Electrical */}
            <article className="service-feature-card secondary-card">
              <div className="service-feature-visual">
                <Image src="/images/electrical-panel.jpg" alt="Electrical distribution panel and mounting structure" fill sizes="(max-width: 900px) 100vw, 38vw" />
                <span className="service-badge">INFRASTRUCTURE</span>
              </div>
              <div className="service-feature-body">
                <div className="service-header-row">
                  <span className="service-number">02</span>
                  <h3>Solar Structures & Electrical</h3>
                </div>
                <p className="service-desc">Industrial structural fabrication and distribution engineering ensuring structural integrity and code-compliant electrical distribution.</p>
                <ul className="service-spec-list">
                  <li><ShieldCheck size={14} aria-hidden="true" /> H-Beam Solar Structures</li>
                  <li><ShieldCheck size={14} aria-hidden="true" /> Automatic & Manual DB Panels</li>
                  <li><ShieldCheck size={14} aria-hidden="true" /> Single-Phase & Three-Phase Works</li>
                </ul>
                <div className="service-card-action">
                  <a className="text-link" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>Request a Quote <LinkIcon /></a>
                </div>
              </div>
            </article>

            {/* Card 3 — Security Systems */}
            <article className="service-feature-card secondary-card">
              <div className="service-feature-visual">
                <Image src="/images/cctv.jpg" alt="High-definition CCTV surveillance system" fill sizes="(max-width: 900px) 100vw, 38vw" />
                <span className="service-badge">SECURITY</span>
              </div>
              <div className="service-feature-body">
                <div className="service-header-row">
                  <span className="service-number">03</span>
                  <h3>Security Systems</h3>
                </div>
                <p className="service-desc">Professional security and monitoring infrastructure for residential, commercial, and institutional premises.</p>
                <ul className="service-spec-list">
                  <li><ShieldCheck size={14} aria-hidden="true" /> CCTV Surveillance Installation</li>
                  <li><ShieldCheck size={14} aria-hidden="true" /> Remote Mobile Monitoring</li>
                  <li><ShieldCheck size={14} aria-hidden="true" /> Property Access Control</li>
                </ul>
                <div className="service-card-action">
                  <a className="text-link" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>Discuss Security <LinkIcon /></a>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* TECHNOLOGY WE WORK WITH (Section 1 - Positioned immediately after Services) */}
        <section id="technology" className="technology-section section-shell section-pad">
          <div className="technology-header">
            <SectionIntro
              label="EQUIPMENT EXPERIENCE"
              title="Technology We Work With"
              copy="Equipment selection may vary according to system requirements, availability, and project specifications."
            />
          </div>
          <div className="tech-strip" aria-label="Technology brands Electro Tech works with">
            {technologies.map((technology) => (
              <div className="tech-cell" key={technology.name}>
                <div className="tech-logo-wrap">
                  <Image src={technology.src} width={260} height={70} alt={`${technology.name} logo`} sizes="(max-width: 520px) 45vw, 180px" unoptimized />
                </div>
                <span className="tech-name">{technology.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* PROJECTS */}
        <section id="projects" className="projects section-shell section-pad">
          <SectionIntro label="OUR WORK" title="Selected projects" copy="A selection of commercial, institutional, and local solar installations." />
          <div className="project-grid">
            {siteConfig.projects.map((project, index) => {
              const images = ["/images/solar-rooftop.jpg", "/images/commercial-solar.jpg", "/images/hero-solar.jpg", "/images/solar-technician.jpg", "/images/commercial-solar.jpg"];
              return (
                <article className={`project-card project-${index + 1}`} key={project.title}>
                  <div className="project-image">
                    <Image src={images[index]} alt={`Solar project reference for ${project.title}`} fill sizes="(max-width: 700px) 100vw, 50vw" />
                  </div>
                  <div className="project-info">
                    <span className="project-index">0{index + 1}</span>
                    <div className="project-text">
                      <h3>{project.title}</h3>
                      {"location" in project ? <p>{project.location}</p> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="project-note">Project imagery is representative until verified project photographs are supplied.</p>
        </section>

        {/* PROCESS */}
        <section id="process" className="process section-shell section-pad">
          <SectionIntro label="HOW WE WORK" title="From first conversation to final installation." />
          <div className="process-photo">
            <Image src="/images/solar-technician.jpg" alt="Solar installation professional completing rooftop work" fill sizes="100vw" />
          </div>
          <ol className="process-list">
            {[
              ["Consultation", "Understand energy requirements and structural feasibility."],
              ["Site Assessment", "Inspect electrical infrastructure and solar radiation access."],
              ["System Design", "Engineer the optimal inverter, battery, and panel topology."],
              ["Installation", "Execute precise mechanical mounting and electrical integration."],
              ["Support", "Provide ongoing monitoring, warranty service, and support."],
            ].map(([title, copy], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CONTACT / QUOTE FORM */}
        <section id="contact" className="contact section-pad">
          <div className="section-shell contact-layout">
            <div className="contact-copy">
              <p className="eyebrow">START YOUR PROJECT</p>
              <h2>Ready to explore solar for your property?</h2>
              <p>Tell us about your project and Electro Tech can review your requirements and discuss the appropriate next step.</p>
              <div className="contact-details">
                <a href={siteConfig.phoneHref}><Phone aria-hidden="true" /><span>Call</span><strong>{siteConfig.phoneDisplay}</strong></a>
                <a href={siteConfig.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /><span>WhatsApp</span><strong>{siteConfig.phoneDisplay}</strong></a>
                <a href={`mailto:${siteConfig.email}`}><Mail aria-hidden="true" /><span>Email</span><strong>{siteConfig.email}</strong></a>
              </div>
            </div>
            <div className="quote-panel">
              {submitState === "success" ? (
                <div className="success-state" role="status">
                  <span><Check size={25} strokeWidth={2} aria-hidden="true" /></span>
                  <h3>Thanks — your enquiry has been received.</h3>
                  <p>Electro Tech will review your project details and get in touch promptly.</p>
                  <div>
                    <a className="button button-primary" href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">
                      <MessageCircle size={17} aria-hidden="true" /> WhatsApp Us
                    </a>
                    <a className="text-link" href={siteConfig.phoneHref}>Call Electro Tech <LinkIcon /></a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit(submitQuote)} noValidate>
                  <div className="form-heading">
                    <span>PROJECT ENQUIRY</span>
                    <h3>Tell us what you need.</h3>
                  </div>
                  {Object.keys(errors).length > 0 ? <div className="error-summary" role="alert">Please review the highlighted fields.</div> : null}
                  <div className="form-grid">
                    <label>Full Name *<input id="fullName" autoComplete="name" {...register("fullName")} aria-invalid={Boolean(errors.fullName)} />{errors.fullName ? <small>{errors.fullName.message}</small> : null}</label>
                    <label>Phone / WhatsApp *<input inputMode="tel" autoComplete="tel" {...register("phone")} aria-invalid={Boolean(errors.phone)} />{errors.phone ? <small>{errors.phone.message}</small> : null}</label>
                    <label>City / Project Location *<input autoComplete="address-level2" {...register("city")} aria-invalid={Boolean(errors.city)} />{errors.city ? <small>{errors.city.message}</small> : null}</label>
                    <label>Required Service *<select {...register("service")}>{siteConfig.services.map((service) => <option key={service}>{service}</option>)}</select>{errors.service ? <small>{errors.service.message}</small> : null}</label>
                    <label>Email<input type="email" autoComplete="email" {...register("email")} />{errors.email ? <small>{errors.email.message}</small> : null}</label>
                    <label>Company / Organization<input autoComplete="organization" {...register("company")} /></label>
                    {selectedService === "Solar Energy" ? (
                      <>
                        <label>Property Type *<select {...register("propertyType")}><option>Home</option><option>Business</option><option>Institution</option><option>Other</option></select>{errors.propertyType ? <small>{errors.propertyType.message}</small> : null}</label>
                        <label>Preferred System *<select {...register("systemType")}><option>Hybrid</option><option>On-Grid</option><option>Off-Grid</option><option>Not Sure</option></select>{errors.systemType ? <small>{errors.systemType.message}</small> : null}</label>
                        <label>Monthly Electricity Bill<select {...register("monthlyBillRange")}><option value="">Select a PKR range</option>{billRanges.map((range) => <option key={range}>{range}</option>)}</select></label>
                        <label>Required Capacity, if known<input placeholder="e.g. 10 kW" {...register("requiredCapacity")} /></label>
                      </>
                    ) : null}
                    <label className="full-field">Message<textarea rows={3} {...register("message")} /></label>
                    <label className="honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" {...register("website")} /></label>
                  </div>
                  {submitState === "error" ? <p className="submit-error" role="alert">{serverMessage}</p> : null}
                  <div className="form-actions">
                    <button className="button button-primary" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Sending…" : "Request My Quote"} <LinkIcon />
                    </button>
                    <a className="text-link" href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">
                      <MessageCircle size={17} strokeWidth={1.8} aria-hidden="true" /> WhatsApp Us <LinkIcon />
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* FINAL PRE-FOOTER CTA BANNER (Section 3) */}
        <section className="final-cta-banner" aria-label="Final call to action">
          <div className="final-cta-visual">
            <Image src="/images/commercial-solar.jpg" alt="Commercial rooftop solar panels array" fill sizes="100vw" />
            <div className="final-cta-overlay" />
          </div>
          <div className="section-shell final-cta-content">
            <p className="eyebrow light">POWER YOUR FUTURE WITH ELECTROTECH</p>
            <h2>Engineered for Performance & Reliability.</h2>
            <p className="final-cta-copy">Solar and electrical solutions designed for sustainable savings, robust infrastructure, and uninterrupted power.</p>
            <div className="final-cta-actions">
              <a className="button button-primary" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>
                Request a Solar Quote <LinkIcon />
              </a>
              <a className="button button-outline-light" href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" /> WhatsApp Consultation <LinkIcon />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* MAIN FOOTER (Lumora-inspired) */}
      <footer className="footer">
        <div className="section-shell footer-main">
          <div className="footer-brand-block">
            <a className="footer-brand" href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }} aria-label="Electro Tech home">
              <Image src="/logos/electrotech-horizontal-dark.png" width={407} height={112} alt="Electro Tech — Electrical & Solar Solutions" />
            </a>
            <p className="footer-descriptor">Electrical & Solar Solutions</p>
            <p className="footer-statement">Solar, electrical and infrastructure solutions engineered for homes, businesses, and institutions.</p>
            <div className="footer-direct-contacts">
              <a href={siteConfig.phoneHref}><Phone size={15} strokeWidth={1.8} aria-hidden="true" /><span>{siteConfig.phoneDisplay}</span></a>
              <a href={siteConfig.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={15} strokeWidth={1.8} aria-hidden="true" /><span>WhatsApp</span></a>
              <a href={`mailto:${siteConfig.email}`}><Mail size={15} strokeWidth={1.8} aria-hidden="true" /><span>{siteConfig.email}</span></a>
            </div>
          </div>
          <div className="footer-column">
            <h2>Company</h2>
            {footerCompany.map(([label, href]) => (
              <a key={href} href={href} onClick={(e) => { e.preventDefault(); scrollToSection(href); }}>
                {label}
              </a>
            ))}
          </div>
          <div className="footer-column">
            <h2>Solutions</h2>
            {footerSolutions.map(([label, href]) => (
              <a key={label} href={href} onClick={(e) => { e.preventDefault(); scrollToSection(href); }}>
                {label}
              </a>
            ))}
          </div>
          <div className="footer-column footer-contact-col">
            <h2>Get In Touch</h2>
            <p>Office hours: Mon–Sat 9:00 AM – 6:00 PM</p>
            <a className="footer-cta-link" href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection("contact"); }}>
              Book an on-site solar survey <LinkIcon />
            </a>
          </div>
        </div>
        <div className="section-shell footer-bottom">
          <span>© {new Date().getFullYear()} Electro Tech. All rights reserved.</span>
          <span>Engineered for Performance and Reliability</span>
          <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }}>
            Back to top <ArrowUp size={15} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </>
  );
}

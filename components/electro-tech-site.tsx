"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { siteConfig } from "@/lib/site-config";
import { QuoteInput, quoteSchema } from "@/lib/validation";

const navItems = [
  ["About", "#about"],
  ["Services", "#services"],
  ["Projects", "#projects"],
  ["Process", "#process"],
  ["Contact", "#contact"],
] as const;

const solarContent = {
  "On-Grid": {
    eyebrow: "Direct connection",
    description: "Solar generation supports the property while the grid remains connected.",
    battery: false,
    grid: true,
  },
  Hybrid: {
    eyebrow: "Flexible continuity",
    description: "Solar, battery storage and the grid work together in one adaptable configuration.",
    battery: true,
    grid: true,
  },
  "Off-Grid": {
    eyebrow: "Independent supply",
    description: "Solar generation and battery storage support the property without an active grid path.",
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

function Arrow() {
  return <span aria-hidden="true">↗</span>;
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
      <div className="energy-node sun-node"><span className="sun-shape" /><b>Sun</b></div>
      <span className="flow-line vertical active" aria-hidden="true" />
      <div className="energy-node panel-node"><span className="panel-shape"><i /><i /><i /><i /></span><b>Solar panels</b></div>
      <span className="flow-line vertical active" aria-hidden="true" />
      <div className="energy-node inverter-node"><span className="inverter-shape">~</span><b>Inverter</b></div>
      <span className="flow-line vertical active" aria-hidden="true" />
      <div className="energy-node property-node"><span className="house-shape"><i /></span><b>Property</b></div>
      <div className="branch-lines" aria-hidden="true">
        <span className={`branch left ${details.battery ? "active" : "inactive"}`} />
        <span className={`branch right ${details.grid ? "active" : "inactive"}`} />
      </div>
      <div className="energy-branches">
        <div className={`energy-node compact ${details.battery ? "enabled" : "disabled"}`}>
          <span className="battery-shape"><i /></span><b>Battery</b>
        </div>
        <div className={`energy-node compact ${details.grid ? "enabled" : "disabled"}`}>
          <span className="grid-shape"><i /><i /><i /></span><b>Grid</b>
        </div>
      </div>
    </div>
  );
}

export function ElectroTechSite() {
  const reducedMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [solarType, setSolarType] = useState<SolarType>("Hybrid");
  const [propertyType, setPropertyType] = useState("Home");
  const [startingBill, setStartingBill] = useState<(typeof billRanges)[number]>("PKR 25,000–50,000");
  const [startingSystem, setStartingSystem] = useState<SolarType | "Not Sure">("Hybrid");
  const [submitState, setSubmitState] = useState<"idle" | "success" | "error">("idle");
  const [serverMessage, setServerMessage] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
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

  function continueToQuote() {
    setValue("service", "Solar Energy", { shouldValidate: true });
    setValue("propertyType", propertyType as "Home" | "Business" | "Institution" | "Other", { shouldValidate: true });
    setValue("monthlyBillRange", startingBill, { shouldValidate: true });
    setValue("systemType", startingSystem, { shouldValidate: true });
    document.querySelector("#contact")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    window.setTimeout(() => document.querySelector<HTMLInputElement>("#fullName")?.focus(), reducedMotion ? 0 : 650);
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
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="header-inner">
          <a className="brand" href="#home" aria-label="Electro Tech home">
            <Image src="/logos/electrotech-wordmark.png" width={512} height={512} alt="Electro Tech — Electrical & Solar Solutions" priority />
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <a className="button button-dark header-cta" href="#contact">Request a Solar Quote <Arrow /></a>
          <button ref={menuButtonRef} className="menu-button" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen((open) => !open)}>
            <span /><span />
          </button>
        </div>
        <AnimatePresence>
          {menuOpen ? (
            <motion.nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation" initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<span>↗</span></a>)}
              <a className="button button-lime" href="#contact" onClick={() => setMenuOpen(false)}>Request a Solar Quote</a>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <main id="main-content">
        <section id="home" className="hero section-shell">
          <div className="hero-copy">
            <motion.p className="eyebrow" {...motionProps} transition={{ duration: 0.45 }}>CLEAN ENERGY. SMARTER SYSTEMS.</motion.p>
            <motion.h1 {...motionProps} transition={{ duration: 0.6, delay: reducedMotion ? 0 : 0.08 }}>Smart solar energy for <em>everyday life.</em></motion.h1>
            <motion.p className="hero-lede" {...motionProps} transition={{ duration: 0.55, delay: reducedMotion ? 0 : 0.16 }}>Complete solar and electrical solutions designed for homes, businesses, and institutions.</motion.p>
            <motion.div className="hero-actions" {...motionProps} transition={{ duration: 0.5, delay: reducedMotion ? 0 : 0.24 }}>
              <a className="button button-lime" href="#contact">Get Solar Quote <Arrow /></a>
              <a className="text-link" href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">WhatsApp Us <Arrow /></a>
            </motion.div>
          </div>
          <motion.div className="hero-visual" initial={reducedMotion ? false : { clipPath: "inset(0 0 100% 0 round 32px)" }} animate={{ clipPath: "inset(0 0 0% 0 round 32px)" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <Image src="/images/hero-solar.jpg" alt="Solar panels installed on a residential rooftop beneath a clear sky" fill priority sizes="(max-width: 800px) 100vw, 58vw" />
            <div className="hero-range"><strong>5 kW–1 MW</strong><span>Solar system range</span></div>
            <div className="hero-caption"><span>Solar-first solutions</span><b>Homes • Businesses • Institutions</b></div>
          </motion.div>
        </section>

        <section className="facts section-shell" aria-label="Electro Tech key facts">
          <div><span>01</span><strong>Since 2019</strong><p>Established electrical and solar solutions.</p></div>
          <div><span>02</span><strong>5 kW–1 MW</strong><p>Approximate solar system range.</p></div>
          <div><span>03</span><strong>On-Grid / Hybrid / Off-Grid</strong><p>Configurations for different requirements.</p></div>
        </section>

        <section id="about" className="about section-shell section-pad">
          <div className="about-copy">
            <SectionIntro label="ABOUT ELECTRO TECH" title="Energy solutions built around real requirements." />
            <p>Since 2019, Electro Tech has provided integrated solar and electrical solutions for homes, businesses, and institutions.</p>
            <p className="about-focus">Solar is our <span>primary focus.</span></p>
            <ul className="about-points">
              <li><b>Since 2019</b><span>Established</span></li>
              <li><b>Solar + Electrical</b><span>Integrated capability</span></li>
              <li><b>5 kW–1 MW</b><span>Approximate range</span></li>
              <li><b>Homes / Business / Institutions</b><span>Project types</span></li>
            </ul>
          </div>
          <div className="about-images">
            <div className="about-image-primary"><Image src="/images/solar-technician.jpg" alt="Solar technician working carefully on a rooftop installation" fill sizes="(max-width: 800px) 90vw, 42vw" /></div>
            <div className="about-image-secondary"><Image src="/images/electrical-panel.jpg" alt="Electrician working on a distribution panel" fill sizes="(max-width: 800px) 55vw, 22vw" /></div>
            <span className="image-note">Measured. Installed. Supported.</span>
          </div>
        </section>

        <section id="solar" className="solar-section section-pad">
          <div className="section-shell">
            <SectionIntro label="SOLAR SYSTEMS" title="Choose the solar system that fits your energy needs." copy="Explore how each configuration connects solar generation to your property." />
            <div className="solar-layout">
              <div className="solar-controls">
                <div className="solar-tabs" role="tablist" aria-label="Solar system type">
                  {(Object.keys(solarContent) as SolarType[]).map((type) => (
                    <button key={type} type="button" role="tab" aria-selected={solarType === type} onClick={() => setSolarType(type)}>{type}</button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={solarType} className="solar-description" initial={reducedMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    <p className="eyebrow">{solarContent[solarType].eyebrow}</p>
                    <h3>{solarType} solar</h3>
                    <p>{solarContent[solarType].description}</p>
                    <a className="text-link" href="#contact">Discuss this system <Arrow /></a>
                  </motion.div>
                </AnimatePresence>
              </div>
              <EnergyDiagram active={solarType} />
            </div>
          </div>
        </section>

        <section className="starting section-shell section-pad">
          <div className="starting-heading">
            <p className="eyebrow">A SIMPLE FIRST STEP</p>
            <h2>Find your solar starting point.</h2>
            <p>Share a few project details so Electro Tech can better understand your requirements.</p>
          </div>
          <div className="starting-form" aria-label="Solar starting point">
            <fieldset>
              <legend>1. Property type</legend>
              <div className="choice-row">{["Home", "Business", "Institution", "Other"].map((value) => <button key={value} type="button" className={propertyType === value ? "active" : ""} onClick={() => setPropertyType(value)} aria-pressed={propertyType === value}>{value}</button>)}</div>
            </fieldset>
            <label>2. Monthly electricity bill
              <select value={startingBill} onChange={(event) => setStartingBill(event.target.value as (typeof billRanges)[number])}>{billRanges.map((range) => <option key={range}>{range}</option>)}</select>
            </label>
            <fieldset>
              <legend>3. System preference</legend>
              <div className="choice-row">{["On-Grid", "Hybrid", "Off-Grid", "Not Sure"].map((value) => <button key={value} type="button" className={startingSystem === value ? "active" : ""} onClick={() => setStartingSystem(value as SolarType | "Not Sure")} aria-pressed={startingSystem === value}>{value}</button>)}</div>
            </fieldset>
            <button className="button button-lime starting-submit" type="button" onClick={continueToQuote}>Continue to Solar Quote <Arrow /></button>
          </div>
        </section>

        <section id="services" className="services section-shell section-pad">
          <SectionIntro label="OUR CORE SERVICES" title="Complete solutions. Clean energy. Reliable infrastructure." />
          <div className="service-mosaic">
            <article className="service-card service-solar">
              <Image src="/images/solar-rooftop.jpg" alt="Large rooftop solar panel installation" fill sizes="(max-width: 800px) 100vw, 60vw" />
              <div className="service-overlay"><p>01 / PRIMARY SERVICE</p><h3>Solar Energy</h3><span>On-Grid • Hybrid • Off-Grid</span><a href="#solar">Explore solar systems <Arrow /></a></div>
            </article>
            <article className="service-card service-structures">
              <Image src="/images/commercial-solar.jpg" alt="Solar panels supported by a commercial rooftop mounting system" fill sizes="(max-width: 800px) 100vw, 40vw" />
              <div className="service-overlay"><p>02</p><h3>Solar Structures</h3><span>H-Beam and mounting structures</span></div>
            </article>
            <article className="service-card service-electrical">
              <Image src="/images/electrical-panel.jpg" alt="Professional electrical distribution panel work" fill sizes="(max-width: 800px) 100vw, 40vw" />
              <div className="service-overlay"><p>03</p><h3>Electrical Works</h3><span>Automatic / Manual D.B Panels • Single / Three Phase</span></div>
            </article>
            <article className="service-card service-security">
              <Image src="/images/cctv.jpg" alt="Mounted CCTV surveillance camera" fill sizes="(max-width: 800px) 100vw, 28vw" />
              <div className="service-overlay"><p>04</p><h3>Security Systems</h3><span>CCTV installation and surveillance</span></div>
            </article>
          </div>
        </section>

        <section className="solar-value">
          <div className="section-shell value-layout">
            <div className="value-image"><Image src="/images/commercial-solar.jpg" alt="Expansive commercial rooftop solar array" fill sizes="(max-width: 800px) 100vw, 48vw" /></div>
            <div className="value-copy">
              <p className="eyebrow">WHY SOLAR</p>
              <h2>Built for smarter energy use.</h2>
              {[ ["01", "Generate", "Produce electricity from solar energy."], ["02", "Manage", "Choose a configuration suited to project requirements."], ["03", "Scale", "Approximately 5 kW–1 MW systems."] ].map(([number, title, copy]) => <div className="value-step" key={title}><span>{number}</span><h3>{title}</h3><p>{copy}</p></div>)}
            </div>
          </div>
        </section>

        <section id="projects" className="projects section-shell section-pad">
          <SectionIntro label="OUR WORK" title="Selected projects" copy="A selection of commercial, institutional and local solar work." />
          <div className="project-grid">
            {siteConfig.projects.map((project, index) => {
              const images = ["/images/solar-rooftop.jpg", "/images/commercial-solar.jpg", "/images/hero-solar.jpg", "/images/solar-technician.jpg", "/images/commercial-solar.jpg"];
              return <article className={`project-card project-${index + 1}`} key={project.title}><div className="project-image"><Image src={images[index]} alt={`Solar project reference for ${project.title}`} fill sizes="(max-width: 700px) 100vw, 50vw" /></div><div><span>0{index + 1}</span><h3>{project.title}</h3>{"location" in project ? <p>{project.location}</p> : null}</div></article>;
            })}
          </div>
          <p className="project-note">Project imagery is representative until verified project photographs are supplied.</p>
        </section>

        <section className="technology section-pad">
          <div className="section-shell tech-layout">
            <SectionIntro label="EQUIPMENT EXPERIENCE" title="Technology we work with" copy="Equipment selection may vary according to system requirements, availability, and project specifications." />
            <div className="tech-matrix">{siteConfig.technologies.map((technology, index) => <div key={technology}><span>0{index + 1}</span><strong>{technology}</strong></div>)}</div>
          </div>
        </section>

        <section id="process" className="process section-shell section-pad">
          <SectionIntro label="HOW WE WORK" title="From first conversation to final installation." />
          <div className="process-photo"><Image src="/images/solar-technician.jpg" alt="Solar installation professional completing rooftop work" fill sizes="100vw" /></div>
          <ol className="process-list">
            {[["Consultation", "Understand project requirements."], ["Site Assessment", "Review the site and technical requirements."], ["System Design", "Plan the appropriate solution."], ["Installation", "Complete professional installation."], ["Support", "Provide applicable post-installation support."]].map(([title, copy], index) => <li key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}
          </ol>
        </section>

        <section id="contact" className="contact section-pad">
          <div className="section-shell contact-layout">
            <div className="contact-copy">
              <p className="eyebrow">START YOUR PROJECT</p>
              <h2>Ready to explore solar for your property?</h2>
              <p>Tell us about your project and Electro Tech can review your requirements and discuss the appropriate next step.</p>
              <div className="contact-details">
                <a href={siteConfig.phoneHref}><span>Call</span><strong>{siteConfig.phoneDisplay}</strong></a>
                <a href={siteConfig.whatsappHref} target="_blank" rel="noreferrer"><span>WhatsApp</span><strong>{siteConfig.phoneDisplay}</strong></a>
                <a href={`mailto:${siteConfig.email}`}><span>Email</span><strong>{siteConfig.email}</strong></a>
              </div>
            </div>
            <div className="quote-panel">
              {submitState === "success" ? (
                <div className="success-state" role="status"><span>✓</span><h3>Thanks — your enquiry has been received.</h3><p>Electro Tech can now review your project information.</p><div><a className="button button-lime" href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">WhatsApp Us</a><a className="text-link light" href={siteConfig.phoneHref}>Call Electro Tech <Arrow /></a></div></div>
              ) : (
                <form onSubmit={handleSubmit(submitQuote)} noValidate>
                  <div className="form-heading"><span>PROJECT ENQUIRY</span><h3>Tell us what you need.</h3></div>
                  {Object.keys(errors).length > 0 ? <div className="error-summary" role="alert">Please review the highlighted fields.</div> : null}
                  <div className="form-grid">
                    <label>Full Name *<input id="fullName" autoComplete="name" {...register("fullName")} aria-invalid={Boolean(errors.fullName)} />{errors.fullName ? <small>{errors.fullName.message}</small> : null}</label>
                    <label>Phone / WhatsApp *<input inputMode="tel" autoComplete="tel" {...register("phone")} aria-invalid={Boolean(errors.phone)} />{errors.phone ? <small>{errors.phone.message}</small> : null}</label>
                    <label>City / Project Location *<input autoComplete="address-level2" {...register("city")} aria-invalid={Boolean(errors.city)} />{errors.city ? <small>{errors.city.message}</small> : null}</label>
                    <label>Required Service *<select {...register("service")}>{siteConfig.services.map((service) => <option key={service}>{service}</option>)}</select>{errors.service ? <small>{errors.service.message}</small> : null}</label>
                    <label>Email<input type="email" autoComplete="email" {...register("email")} />{errors.email ? <small>{errors.email.message}</small> : null}</label>
                    <label>Company / Organization<input autoComplete="organization" {...register("company")} /></label>
                    {selectedService === "Solar Energy" ? <>
                      <label>Property Type *<select {...register("propertyType")}><option>Home</option><option>Business</option><option>Institution</option><option>Other</option></select>{errors.propertyType ? <small>{errors.propertyType.message}</small> : null}</label>
                      <label>Preferred System *<select {...register("systemType")}><option>On-Grid</option><option>Hybrid</option><option>Off-Grid</option><option>Not Sure</option></select>{errors.systemType ? <small>{errors.systemType.message}</small> : null}</label>
                      <label>Monthly Electricity Bill<select {...register("monthlyBillRange")}><option value="">Select a PKR range</option>{billRanges.map((range) => <option key={range}>{range}</option>)}</select></label>
                      <label>Required Capacity, if known<input placeholder="e.g. 10 kW" {...register("requiredCapacity")} /></label>
                    </> : null}
                    <label className="full-field">Message<textarea rows={4} {...register("message")} /></label>
                    <label className="honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" {...register("website")} /></label>
                  </div>
                  {submitState === "error" ? <p className="submit-error" role="alert">{serverMessage}</p> : null}
                  <div className="form-actions"><button className="button button-lime" type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Request My Quote"} <Arrow /></button><a className="text-link light" href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">WhatsApp Us <Arrow /></a></div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="section-shell footer-top"><a className="footer-brand" href="#home"><Image src="/logos/electrotech-wordmark.png" width={512} height={512} alt="Electro Tech" /></a><p>Electrical & Solar Solutions</p><a href="#home">Back to top ↑</a></div>
        <div className="section-shell footer-bottom"><span>© {new Date().getFullYear()} Electro Tech</span><span>Solar • Structures • Electrical • Security</span></div>
      </footer>
    </>
  );
}

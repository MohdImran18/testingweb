"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Droplets, Waves, Ship,
  Building2, MapPin, Recycle, Leaf, Trash2, CalendarDays, Ruler,
  User, Mail, Phone, Briefcase, Globe2, LoaderCircle
} from "lucide-react";

type FormState = {
  waterbodyType: string;
  cleaningNeeds: string[];
  country: string;
  region: string;
  waterbodyName: string;
  area: string;
  areaUnit: string;
  projectTimeline: string;
  projectDetails: string;
  fullName: string;
  company: string;
  jobTitle: string;
  email: string;
  phone: string;
  industry: string;
  consent: boolean;
};

const initial: FormState = {
  waterbodyType: "", cleaningNeeds: [], country: "", region: "",
  waterbodyName: "", area: "", areaUnit: " hectares",
  projectTimeline: "", projectDetails: "", fullName: "", company: "",
  jobTitle: "", email: "", phone: "", industry: "", consent: false
};

const waterbodies = [
  { value: "River", icon: Waves, note: "Rivers and waterways" },
  { value: "Lake", icon: Droplets, note: "Lakes and reservoirs" },
  { value: "Port / Harbour", icon: Ship, note: "Ports and coastal areas" },
  { value: "Canal / Pond", icon: Building2, note: "Canals, ponds and other waterbodies" },
];
const needs = [
  { value: "Floating waste collection", icon: Trash2, note: "Plastic, debris and floating litter" },
  { value: "Water hyacinth removal", icon: Leaf, note: "Water hyacinth and invasive plants" },
  { value: "Aquatic weed removal", icon: Recycle, note: "Other aquatic vegetation" },
  { value: "Oil / surface response", icon: Droplets, note: "Surface pollutants and oil response" },
  { value: "Multiple cleaning requirements", icon: Waves, note: "A combination of requirements" },
];

export default function AssessmentPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState("");

  const progress = useMemo(() => `${step * 25}%`, [step]);
  const update = <K extends keyof FormState,>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function toggleNeed(value: string) {
    setForm((current) => ({
      ...current,
      cleaningNeeds: current.cleaningNeeds.includes(value)
        ? current.cleaningNeeds.filter((item) => item !== value)
        : [...current.cleaningNeeds, value],
    }));
  }

  function next() {
    setError("");
    if (step === 1 && !form.waterbodyType) return setError("Please select your waterbody type.");
    if (step === 2 && form.cleaningNeeds.length === 0) return setError("Please select at least one cleaning requirement.");
    if (step === 3 && (!form.country.trim() || !form.region.trim())) return setError("Please enter the country and project location.");
    setStep((current) => Math.min(4, current + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form.fullName.trim() || !form.company.trim() || !form.email.trim() ||
        !form.phone.trim() || !form.industry.trim() || !form.consent) {
      setError("Please complete all required fields and give consent to be contacted.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sourcePage: "/assessment",
          formType: "project-assessment",
          formId: "clearbotProjectAssessment",
          useCase: [
            `Waterbody: ${form.waterbodyType}`,
            `Cleaning requirements: ${form.cleaningNeeds.join(", ")}`,
            `Waterbody name: ${form.waterbodyName || "Not provided"}`,
            `Estimated area: ${form.area ? `${form.area} ${form.areaUnit}` : "Not provided"}`,
            `Project timeline: ${form.projectTimeline || "Not provided"}`,
            `Project details: ${form.projectDetails || "Not provided"}`,
          ].join("\n"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We could not submit your request. Please try again.");
      setReference(data.enquiryId || "");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="assessment-page">
      <header className="assessment-nav">
        <Link href="/index.html#home" className="assessment-brand">
          <img src="/assets/clear-robotics-logo.png" alt="Clear Robotics" />
        </Link>
        <Link href="/index.html#home" className="assessment-nav-link">Back to website</Link>
      </header>

      <section className="assessment-shell">
        <div className="assessment-intro">
          <span className="assessment-eyebrow"><span /> PROJECT ASSESSMENT</span>
          <h1>Let’s understand your <em>waterway challenge.</em></h1>
          <p>Share a few details about your waterbody and cleaning requirements. Our team will review your project and get in touch to discuss the next steps.</p>
          <div className="assessment-trust">
            <span><CheckCircle2 size={16}/> Tailored project review</span>
            <span><CheckCircle2 size={16}/> No-obligation discussion</span>
          </div>
        </div>

        {!submitted ? (
          <form className="assessment-card" onSubmit={submit}>
            <div className="assessment-card-top">
              <div>
                <span className="assessment-step-label">STEP {step} OF 4</span>
                <h2>{["Your waterbody", "Cleaning requirements", "Project location & scale", "Your contact details"][step - 1]}</h2>
              </div>
              <span className="assessment-step-count">{step}/4</span>
            </div>
            <div className="assessment-progress"><span style={{ width: progress }} /></div>

            {step === 1 && <div className="assessment-fields">
              <label className="assessment-label">What type of waterbody do you want to clean? <b>*</b></label>
              <div className="assessment-choice-grid">
                {waterbodies.map(({ value, icon: Icon, note }) => (
                  <button type="button" key={value} onClick={() => update("waterbodyType", value)}
                    className={`assessment-choice ${form.waterbodyType === value ? "selected" : ""}`}>
                    <span className="assessment-choice-icon"><Icon size={22}/></span>
                    <strong>{value}</strong><small>{note}</small>
                    {form.waterbodyType === value && <Check className="assessment-choice-check" size={17}/>}
                  </button>
                ))}
              </div>
            </div>}

            {step === 2 && <div className="assessment-fields">
              <label className="assessment-label">What would you like help with? <b>*</b></label>
              <p className="assessment-hint">Select all that apply to your project.</p>
              <div className="assessment-needs-list">
                {needs.map(({ value, icon: Icon, note }) => (
                  <button type="button" key={value} onClick={() => toggleNeed(value)}
                    className={`assessment-need ${form.cleaningNeeds.includes(value) ? "selected" : ""}`}>
                    <span className="assessment-choice-icon"><Icon size={21}/></span>
                    <span><strong>{value}</strong><small>{note}</small></span>
                    <span className="assessment-checkbox">{form.cleaningNeeds.includes(value) && <Check size={14}/>}</span>
                  </button>
                ))}
              </div>
            </div>}

            {step === 3 && <div className="assessment-fields">
              <label className="assessment-label">Where is your project located? <b>*</b></label>
              <div className="assessment-input-grid">
                <label className="assessment-input-wrap"><span><Globe2 size={15}/> Country *</span><input required value={form.country} onChange={e => update("country", e.target.value)} placeholder="e.g. India"/></label>
                <label className="assessment-input-wrap"><span><MapPin size={15}/> City / State / Region *</span><input required value={form.region} onChange={e => update("region", e.target.value)} placeholder="e.g. Mumbai, Maharashtra"/></label>
              </div>
              <div className="assessment-input-grid">
                <label className="assessment-input-wrap"><span>Waterbody / project name</span><input value={form.waterbodyName} onChange={e => update("waterbodyName", e.target.value)} placeholder="Name (if known)"/></label>
                <label className="assessment-input-wrap"><span><Ruler size={15}/> Approx. waterbody area</span><div className="assessment-inline-input"><input type="number" min="0" step="any" value={form.area} onChange={e => update("area", e.target.value)} placeholder="Enter area"/><select value={form.areaUnit} onChange={e => update("areaUnit", e.target.value)}><option value=" hectares">Hectares</option><option value=" acres">Acres</option><option value=" sq. km">Sq. km</option><option value=" sq. metres">Sq. metres</option><option value=" km length">Km length</option><option value=" Not sure">Not sure</option></select></div></label>
              </div>
              <label className="assessment-input-wrap"><span><CalendarDays size={15}/> Expected project timeline</span><select value={form.projectTimeline} onChange={e => update("projectTimeline", e.target.value)}><option value="">Select timeline</option><option>Immediately</option><option>Within 1–3 months</option><option>Within 3–6 months</option><option>Within 6–12 months</option><option>Planning / exploring</option></select></label>
              <label className="assessment-input-wrap"><span>Additional project information</span><textarea rows={3} value={form.projectDetails} onChange={e => update("projectDetails", e.target.value)} placeholder="Tell us more about the challenge, operating conditions or project goals (optional)."/></label>
            </div>}

            {step === 4 && <div className="assessment-fields">
              <label className="assessment-label">Who should our team contact? <b>*</b></label>
              <div className="assessment-input-grid">
                <label className="assessment-input-wrap"><span><User size={15}/> Full name *</span><input required autoComplete="name" value={form.fullName} onChange={e => update("fullName", e.target.value)} placeholder="Your name"/></label>
                <label className="assessment-input-wrap"><span><Building2 size={15}/> Organisation *</span><input required autoComplete="organization" value={form.company} onChange={e => update("company", e.target.value)} placeholder="Company / organisation"/></label>
              </div>
              <div className="assessment-input-grid">
                <label className="assessment-input-wrap"><span><Mail size={15}/> Work email *</span><input required type="email" autoComplete="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="name@company.com"/></label>
                <label className="assessment-input-wrap"><span><Phone size={15}/> Phone number *</span><input required type="tel" autoComplete="tel" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+ Country code and number"/></label>
              </div>
              <div className="assessment-input-grid">
                <label className="assessment-input-wrap"><span><Briefcase size={15}/> Job title</span><input value={form.jobTitle} onChange={e => update("jobTitle", e.target.value)} placeholder="e.g. Project Manager"/></label>
                <label className="assessment-input-wrap"><span>Industry / organisation type *</span><select required value={form.industry} onChange={e => update("industry", e.target.value)}><option value="">Select industry</option><option>Government / Municipality</option><option>Port / Maritime</option><option>Environmental services</option><option>Infrastructure / Engineering</option><option>Industrial / Commercial</option><option>NGO / Non-profit</option><option>Consultant / Contractor</option><option>Other</option></select></label>
              </div>
              <label className="assessment-consent"><input type="checkbox" checked={form.consent} onChange={e => update("consent", e.target.checked)}/><span>I agree that Clear Robotics may contact me about this project assessment and use the information provided to respond to my enquiry. *</span></label>
            </div>}

            {error && <div className="assessment-error" role="alert">{error}</div>}
            <div className="assessment-actions">
              {step > 1 ? <button type="button" className="assessment-back" onClick={() => { setError(""); setStep(s => s - 1); }}><ArrowLeft size={17}/> Back</button> : <span/>}
              {step < 4 ? <button type="button" className="assessment-next" onClick={next}>Continue <ArrowRight size={17}/></button> :
                <button type="submit" className="assessment-next" disabled={busy}>{busy ? <><LoaderCircle className="assessment-spin" size={17}/> Submitting…</> : <>Submit assessment <ArrowRight size={17}/></>}</button>}
            </div>
            <p className="assessment-privacy">Your project information will only be used to review and respond to your enquiry.</p>
          </form>
        ) : (
          <div className="assessment-success">
            <div className="assessment-success-icon"><CheckCircle2 size={34}/></div>
            <span className="assessment-eyebrow">REQUEST RECEIVED</span>
            <h2>Thank you for sharing your project.</h2>
            <p>Our Clearbot team will review your waterbody requirements and contact you shortly to discuss a suitable way forward.</p>
            {reference && <div className="assessment-reference">Your enquiry reference <strong>{reference.slice(0, 8).toUpperCase()}</strong></div>}
            <div className="assessment-success-note"><Phone size={18}/> Please keep your phone available. Our team will call you.</div>
            <Link href="/index.html#home" className="assessment-next assessment-home-link">Return to Clearbot website <ArrowRight size={17}/></Link>
          </div>
        )}
      </section>
      <footer className="assessment-footer">© {new Date().getFullYear()} Clear Robotics. Cleaner waterways for a healthier planet.</footer>
    </main>
  );
}

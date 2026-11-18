"use client";

import { FormEvent, useState } from "react";

export default function QuickContactForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fullName: data.get("fullName"), email: data.get("email"), phone: data.get("phone"),
          useCase: "Website contact enquiry", source: "website", sourcePage: window.location.pathname,
          formType: "blog-contact", formFields: { "Full Name": data.get("fullName"), "Business Email": data.get("email"), "Phone Number": data.get("phone") },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit your enquiry. Please try again.");
      setMessage(`Thank you, ${String(data.get("fullName") || "").trim()}. Your enquiry has been received.`);
      form.reset();
    } catch (e) {
      setError(true); setMessage(e instanceof Error ? e.message : "Could not submit your enquiry.");
    } finally { setBusy(false); }
  }

  return <section className="cb-global-contact"><div className="cb-global-contact-inner">
    <span className="cb-global-contact-kicker">START A CONVERSATION</span>
    <h2>Tell us about your waterway project.</h2>
    <p>Share your contact details and our team will get in touch.</p>
    <form onSubmit={submit}>
      <label><span>Full name</span><input name="fullName" type="text" autoComplete="name" placeholder="Your full name" required /></label>
      <label><span>Business email</span><input name="email" type="email" autoComplete="email" placeholder="name@company.com" required /></label>
      <label><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" placeholder="Include country code" required /></label>
      <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send enquiry ↗"}</button>
      {message && <p className={`form-feedback ${error ? "is-error" : "is-success"}`} role="status">{message}</p>}
    </form>
  </div></section>;
}

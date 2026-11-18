"use client";
import { useEffect, useRef, useState } from "react";
import PremiumEffects from "./PremiumEffects";

type Props = {
  body: string;
  styles: string[];
  links: string[];
  scripts: { src?: string; code?: string; id?: string; type?: string }[];
  title: string;
  heroSlides?: string[];
};

type SubmitControl = HTMLButtonElement | HTMLInputElement;

function normaliseKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFormValues(form: HTMLFormElement) {
  const values: Record<string, string> = {};
  const data = new FormData(form);
  for (const [key, entry] of data.entries()) {
    if (typeof entry !== "string") continue;
    const value = entry.trim();
    if (!value) continue;
    values[key] = values[key] ? `${values[key]}, ${value}` : value;
  }
  return values;
}

function pickField(values: Record<string, string>, ...aliases: string[]) {
  const aliasSet = new Set(aliases.map(normaliseKey));
  for (const [key, value] of Object.entries(values)) {
    if (aliasSet.has(normaliseKey(key)) && value) return value;
  }
  return "";
}

function HomeHeroCarousel({ slides }: { slides: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const intervalId = window.setInterval(() => {
      if (!document.hidden) setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [slides.length, paused]);

  const goTo = (index: number) => setActiveIndex((index + slides.length) % slides.length);
  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    if (start !== null && typeof end === "number") {
      const delta = end - start;
      if (Math.abs(delta) > 45) goTo(activeIndex + (delta < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  };

  if (!slides.length) return null;
  return (
    <section
      aria-label="Featured Clear Robotics solutions"
      aria-roledescription="carousel"
      className="hero hero-carousel"
      id="home"
      data-cb-react-carousel="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero-slides">
        {slides.map((slide, index) => (
          <article
            key={`home-hero-slide-${index + 1}`}
            aria-hidden={index !== activeIndex}
            className={`hero-slide${index === activeIndex ? " is-active" : ""}`}
            dangerouslySetInnerHTML={{ __html: slide }}
          />
        ))}
      </div>
      <div className="hero-carousel-controls">
        <div className="hero-slide-progress" aria-live="polite">
          <span className="hero-slide-current">{String(activeIndex + 1).padStart(2, "0")}</span>
          <span className="hero-slide-divider"/>
          <span className="hero-slide-total">{String(slides.length).padStart(2, "0")}</span>
        </div>
        <div aria-label="Choose a slide" className="hero-slide-dots" role="group">
          {slides.map((_, index) => (
            <button
              key={`home-hero-dot-${index + 1}`}
              aria-label={`Show slide ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={`hero-slide-dot${index === activeIndex ? " is-active" : ""}`}
              onClick={() => goTo(index)}
              type="button"
            />
          ))}
        </div>
        <button aria-label="Previous slide" className="hero-slide-arrow" onClick={() => goTo(activeIndex - 1)} type="button">‹</button>
        <button aria-label="Next slide" className="hero-slide-arrow" onClick={() => goTo(activeIndex + 1)} type="button">›</button>
      </div>
    </section>
  );
}

export default function LegacyDocument({ body, styles, links, scripts, heroSlides = [] }: Props) {
  useEffect(() => {
    const nodes: HTMLScriptElement[] = [];
    let cancelled = false;

    // Keep external image failures from leaving empty holes in the website layout.
    const imageFallback = (event: Event) => {
      const img = event.currentTarget as HTMLImageElement;
      if (img.dataset.cbFallbackApplied === "true") return;
      img.dataset.cbFallbackApplied = "true";
      const alt = (img.alt || "").toLowerCase();
      img.src = /logo|client|partner/.test(alt)
        ? "/assets/clear-robotics-logo.png"
        : "/assets/home-hero-waterway-cleanup.jpg";
      img.classList.add("cb-image-fallback");
    };
    const legacyImages = Array.from(document.querySelectorAll<HTMLImageElement>(".legacy-site img"));
    legacyImages.forEach((img) => img.addEventListener("error", imageFallback));

    // Apply admin-managed image replacements to every authored image slot.
    fetch("/api/public/site-images", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (cancelled || !Array.isArray(result?.images)) return;
        const replacements = new Map<string, string>(result.images.filter((item: any) => item.url).map((item: any) => [item.id, item.url]));
        document.querySelectorAll<HTMLImageElement>(".legacy-site img[data-cb-image-key]").forEach((img) => {
          const replacement = replacements.get(img.dataset.cbImageKey || "");
          if (replacement) img.src = replacement;
        });
      }).catch(() => {});

    // Remove obsolete floating WhatsApp / call conversion buttons.
    const removeLegacyFloatingActions = () => {
      document.querySelectorAll<HTMLAnchorElement>(".legacy-site a[href]").forEach((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        const cls = (link.className || "").toString().toLowerCase();
        const floating = /float|fixed|whatsapp|wa-float|call-float/.test(cls) || /position\s*:\s*fixed/i.test(link.getAttribute("style") || "");
        if (floating && (href.includes("wa.me") || href.includes("whatsapp") || href.startsWith("tel:"))) link.remove();
        if (href.includes("assessment")) link.remove();
      });
    };
    removeLegacyFloatingActions();

    // Keep a short contact form directly on every legacy page, not only Contact.
    const legacyRoot = document.querySelector<HTMLElement>(".legacy-site");
    if (legacyRoot && !legacyRoot.querySelector("form")) {
      const section = document.createElement("section");
      section.className = "cb-global-contact";
      section.id = "contact-form";
      section.innerHTML = `
        <div class="cb-global-contact-inner">
          <span class="cb-global-contact-kicker">START A CONVERSATION</span>
          <h2>Tell us about your waterway project.</h2>
          <p>Share your contact details and our team will get in touch.</p>
          <form id="cb-page-contact-form" data-enquiry-form="website" data-enquiry-type="page-contact">
            <label><span>Full name</span><input name="Full Name" type="text" autocomplete="name" placeholder="Your full name" required></label>
            <label><span>Business email</span><input name="Business Email" type="email" autocomplete="email" placeholder="name@company.com" required></label>
            <label><span>Phone number</span><input name="Phone Number" type="tel" autocomplete="tel" placeholder="Include country code" required></label>
            <button type="submit">Send enquiry ↗</button>
          </form>
        </div>`;
      const footer = legacyRoot.querySelector("footer");
      if (footer) footer.before(section); else legacyRoot.appendChild(section);
    }

    // Capture legacy enquiry forms and submit them through the website enquiry API.
    const submitEnquiry = async (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.closest(".cb-admin-login-page, .cb-admin-shell")) return;
      if (form.dataset.nativeSubmit === "true") return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;

      const submitter = (event as SubmitEvent).submitter;
      const control = (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)
        ? submitter
        : form.querySelector<SubmitControl>('button[type="submit"], input[type="submit"]');
      const originalLabel = control instanceof HTMLInputElement
        ? control.value
        : control?.textContent || "Submit enquiry";
      const wasDisabled = control?.disabled || false;
      if (control) {
        control.disabled = true;
        if (control instanceof HTMLInputElement) control.value = "Submitting…";
        else control.textContent = "Submitting…";
      }

      let feedback = form.querySelector<HTMLElement>(
        '[data-enquiry-feedback], [role="status"], .form-feedback, .form-message, .form-status'
      );
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.className = "form-feedback";
        feedback.setAttribute("role", "status");
        feedback.setAttribute("aria-live", "polite");
        form.appendChild(feedback);
      }
      feedback.style.display = "block";
      feedback.classList.remove("is-success", "is-error");
      feedback.textContent = "Sending your enquiry securely…";

      const raw = getFormValues(form);
      const fullName = pickField(raw, "Full Name", "Name", "Your Name", "Contact Name", "fullName", "fullname")
        || [pickField(raw, "First Name", "firstName"), pickField(raw, "Last Name", "lastName")].filter(Boolean).join(" ");
      const email = pickField(raw, "Business Email", "Email", "Email Address", "Work Email", "Your Email", "emailAddress", "email");
      const phone = pickField(raw, "Phone Number", "Phone", "Mobile", "Mobile Number", "Telephone", "Contact Number", "phone");
      const company = pickField(raw, "Company Name", "Company", "Organisation", "Organization", "Organisation Name", "company");
      const jobTitle = pickField(raw, "Job Title", "Designation", "Role", "Position", "jobTitle");
      const country = pickField(raw, "Country", "country");
      const region = pickField(raw, "State / Region", "State", "Region", "City", "Location", "region");
      const industry = pickField(raw, "Industry", "Sector", "Business Type", "industry");
      const useCase = pickField(raw, "Use Case", "Message", "Project Details", "Enquiry", "Enquiry Details", "Requirements", "Comments", "How can we help", "useCase");

      if (!fullName || !email || !phone) {
        feedback.classList.add("is-error");
        feedback.textContent = "Please provide your name, email address and phone number.";
        if (control) {
          control.disabled = wasDisabled;
          if (control instanceof HTMLInputElement) control.value = String(originalLabel);
          else control.textContent = String(originalLabel);
        }
        return;
      }

      const payload = {
        fullName, email, phone, company, jobTitle, country, region, industry, useCase,
        source: "website",
        sourcePage: `${window.location.pathname}${window.location.hash || ""}`,
        formId: form.id || "",
        formType: form.dataset.enquiryType || form.dataset.enquiryForm || "website-enquiry",
        formFields: raw,
        consent: Boolean(form.querySelector<HTMLInputElement>('input[type="checkbox"][name*="consent" i]')?.checked),
      };

      try {
        const response = await fetch("/api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Submission failed (${response.status}). Please try again.`);
        feedback.classList.add("is-success");
        feedback.textContent = `Thank you, ${fullName}. Your enquiry has been received. Reference: ${String(result.enquiryId || "").slice(0, 8).toUpperCase()}. Our team will contact you.`;
        form.reset();
      } catch (error) {
        feedback.classList.add("is-error");
        feedback.textContent = error instanceof Error
          ? error.message
          : "We could not submit your enquiry. Please check your connection and try again.";
      } finally {
        if (control) {
          control.disabled = wasDisabled;
          if (control instanceof HTMLInputElement) control.value = String(originalLabel);
          else control.textContent = String(originalLabel);
        }
      }
    };
    document.addEventListener("submit", submitEnquiry, true);

    // Add published CMS articles to the existing Insights listing.
    const addedBlogNodes: HTMLElement[] = [];
    if (/blog\.html$/.test(window.location.pathname)) {
      fetch("/api/public/blogs", { credentials: "same-origin" })
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          const grid = document.querySelector<HTMLElement>("#blogGrid");
          if (!grid || !Array.isArray(result?.blogs)) return;
          for (const blog of result.blogs) {
            const card = document.createElement("article");
            card.className = "insight-card";
            card.dataset.category = blog.category || "Clearbot Insights";
            const imageLink = document.createElement("a");
            imageLink.className = "insight-image";
            imageLink.href = `/blog/${encodeURIComponent(blog.slug)}`;
            if (blog.featuredImage) {
              const img = document.createElement("img");
              img.src = blog.featuredImage;
              img.alt = blog.imageAlt || blog.title || "Clearbot article";
              img.loading = "lazy";
              imageLink.appendChild(img);
            }
            const content = document.createElement("div");
            content.className = "insight-body";
            const meta = document.createElement("div");
            meta.className = "insight-meta";
            const tag = document.createElement("span");
            tag.className = "insight-tag";
            tag.textContent = blog.category || "Clearbot Insights";
            const date = document.createElement("span");
            date.className = "insight-date";
            date.textContent = blog.publishAt ? new Date(blog.publishAt).toLocaleDateString() : "Clear Robotics Insights";
            meta.append(tag, date);
            const heading = document.createElement("h3");
            heading.textContent = blog.title || "Clearbot Insight";
            const summary = document.createElement("p");
            summary.textContent = blog.excerpt || "";
            const link = document.createElement("a");
            link.className = "insight-link";
            link.href = `/blog/${encodeURIComponent(blog.slug)}`;
            link.textContent = "Read insight ↗";
            content.append(meta, heading, summary, link);
            card.append(imageLink, content);
            grid.appendChild(card);
            addedBlogNodes.push(card);
          }
        }).catch(() => {});
    }

    const load = async () => {
      for (const item of scripts) {
        if (cancelled) return;
        const script = document.createElement("script");
        if (item.id) script.id = item.id;
        if (item.type) script.type = item.type;
        if (item.src) {
          script.src = item.src;
          script.async = false;
          document.body.appendChild(script);
          nodes.push(script);
          await new Promise<void>((resolve) => {
            script.onload = () => resolve();
            script.onerror = () => resolve();
          });
        } else {
          script.textContent = item.code || "";
          document.body.appendChild(script);
          nodes.push(script);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      legacyImages.forEach((img) => img.removeEventListener("error", imageFallback));
      document.removeEventListener("submit", submitEnquiry, true);
      addedBlogNodes.forEach((node) => node.remove());
      nodes.forEach((node) => node.remove());
    };
  }, [scripts]);


  return (
    <>
      {links.map((href, i) => <link key={`${href}-${i}`} rel="stylesheet" href={href} />)}
      {styles.map((css, i) => <style key={i} dangerouslySetInnerHTML={{ __html: css }} />)}
      <div className="legacy-site">
        {heroSlides.length > 0 && <HomeHeroCarousel slides={heroSlides}/> }
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </div>
      <PremiumEffects/>
    </>
  );
}

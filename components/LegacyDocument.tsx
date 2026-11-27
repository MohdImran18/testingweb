"use client";
import { useEffect } from "react";
import PremiumEffects from "./PremiumEffects";

type Props = {
  body: string;
  styles: string[];
  links: string[];
  scripts: { src?: string; code?: string; id?: string; type?: string }[];
  title: string;
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


type HeroSlideDirection = "next" | "prev";

/** Attach behaviour to the original, server-rendered carousel without recreating its slide markup. */
function installLegacyHeroCarousel(root: HTMLElement) {
  const hero = root.querySelector<HTMLElement>(".hero.hero-carousel");
  if (!hero) return () => {};

  const track = hero.querySelector<HTMLElement>(".hero-slides");
  if (!track) return () => {};

  const slides = Array.from(track.querySelectorAll<HTMLElement>(":scope > .hero-slide"));
  const dots = Array.from(hero.querySelectorAll<HTMLButtonElement>(".hero-slide-dot"));
  const previous = hero.querySelector<HTMLButtonElement>("[data-hero-prev], .hero-slide-arrow[aria-label='Previous slide']");
  const next = hero.querySelector<HTMLButtonElement>("[data-hero-next], .hero-slide-arrow[aria-label='Next slide']");
  const currentLabel = hero.querySelector<HTMLElement>("[data-hero-current], .hero-slide-current");
  if (slides.length < 2 || !previous || !next) return () => {};

  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
  let leavingIndex: number | null = null;
  let direction: HeroSlideDirection = "next";
  let touchStartX: number | null = null;
  let autoplayTimer: number | undefined;
  let leavingTimer: number | undefined;

  const sync = () => {
    hero.dataset.slideDirection = direction;
    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      const isLeaving = index === leavingIndex;
      slide.classList.toggle("is-active", isActive);
      slide.classList.toggle("is-leaving", isLeaving);
      slide.setAttribute("aria-hidden", String(!isActive && !isLeaving));
    });
    dots.forEach((dot, index) => {
      const isActive = index === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-pressed", String(isActive));
    });
    if (currentLabel) currentLabel.textContent = String(activeIndex + 1).padStart(2, "0");
  };

  const scheduleAutoplay = () => {
    window.clearTimeout(autoplayTimer);
    if (document.hidden) return;
    autoplayTimer = window.setTimeout(() => {
      goTo(activeIndex + 1, "next");
    }, 5000);
  };

  const goTo = (requestedIndex: number, requestedDirection?: HeroSlideDirection) => {
    const nextIndex = ((requestedIndex % slides.length) + slides.length) % slides.length;
    if (nextIndex === activeIndex) {
      scheduleAutoplay();
      return;
    }

    const forwardDistance = (nextIndex - activeIndex + slides.length) % slides.length;
    const backwardDistance = (activeIndex - nextIndex + slides.length) % slides.length;
    direction = requestedDirection || (forwardDistance <= backwardDistance ? "next" : "prev");
    leavingIndex = activeIndex;
    activeIndex = nextIndex;
    sync();

    window.clearTimeout(leavingTimer);
    leavingTimer = window.setTimeout(() => {
      leavingIndex = null;
      sync();
    }, 760);
    scheduleAutoplay();
  };

  const onPrevious = () => goTo(activeIndex - 1, "prev");
  const onNext = () => goTo(activeIndex + 1, "next");
  const onDot = (event: Event) => {
    const dot = event.currentTarget as HTMLButtonElement;
    const index = dots.indexOf(dot);
    if (index >= 0) goTo(index);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(activeIndex + 1, "next");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(activeIndex - 1, "prev");
    }
  };
  const onTouchStart = (event: TouchEvent) => {
    touchStartX = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const endX = event.changedTouches[0]?.clientX;
    if (touchStartX !== null && typeof endX === "number") {
      const delta = endX - touchStartX;
      if (Math.abs(delta) > 45) goTo(activeIndex + (delta < 0 ? 1 : -1), delta < 0 ? "next" : "prev");
    }
    touchStartX = null;
  };
  const onVisibility = () => {
    if (document.hidden) window.clearTimeout(autoplayTimer);
    else scheduleAutoplay();
  };

  previous.addEventListener("click", onPrevious);
  next.addEventListener("click", onNext);
  dots.forEach((dot) => dot.addEventListener("click", onDot));
  hero.addEventListener("keydown", onKeyDown);
  hero.addEventListener("touchstart", onTouchStart, { passive: true });
  hero.addEventListener("touchend", onTouchEnd, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  if (!hero.hasAttribute("tabindex")) hero.tabIndex = 0;

  sync();
  scheduleAutoplay();

  return () => {
    window.clearTimeout(autoplayTimer);
    window.clearTimeout(leavingTimer);
    previous.removeEventListener("click", onPrevious);
    next.removeEventListener("click", onNext);
    dots.forEach((dot) => dot.removeEventListener("click", onDot));
    hero.removeEventListener("keydown", onKeyDown);
    hero.removeEventListener("touchstart", onTouchStart);
    hero.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

const LEGACY_HERO_SLIDER_CSS = `
/* Preserve the authored hero HTML and animate its original article elements. */
.legacy-site .hero.hero-carousel { position: relative; isolation: isolate; overflow: hidden; }
.legacy-site .hero.hero-carousel .hero-slides { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.legacy-site .hero.hero-carousel .hero-slides > .hero-slide {
  display: flex !important; position: absolute !important; inset: 0; width: 100%; height: 100%;
  align-items: center; opacity: 1 !important; visibility: visible !important; pointer-events: none;
  transform: translate3d(100%,0,0); transition: transform .72s cubic-bezier(.22,.68,.2,1), opacity .72s ease;
  will-change: transform, opacity; z-index: 0; overflow: hidden;
}
.legacy-site .hero.hero-carousel[data-slide-direction="next"] .hero-slides > .hero-slide:not(.is-active):not(.is-leaving) { transform: translate3d(100%,0,0); }
.legacy-site .hero.hero-carousel[data-slide-direction="prev"] .hero-slides > .hero-slide:not(.is-active):not(.is-leaving) { transform: translate3d(-100%,0,0); }
.legacy-site .hero.hero-carousel .hero-slides > .hero-slide.is-active {
  transform: translate3d(0,0,0); opacity: 1 !important; visibility: visible !important; pointer-events: auto; z-index: 2;
}
.legacy-site .hero.hero-carousel[data-slide-direction="next"] .hero-slides > .hero-slide.is-leaving { transform: translate3d(-100%,0,0); z-index: 1; }
.legacy-site .hero.hero-carousel[data-slide-direction="prev"] .hero-slides > .hero-slide.is-leaving { transform: translate3d(100%,0,0); z-index: 1; }
.legacy-site .hero.hero-carousel .hero-slides > .hero-slide.is-leaving .hero-carousel-content { visibility: visible !important; opacity: 1 !important; }
.legacy-site .hero.hero-carousel .hero-slide-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.legacy-site .hero.hero-carousel .hero-slide-shade { position: absolute; inset: 0; z-index: 1; }
.legacy-site .hero.hero-carousel .hero-carousel-content { position: relative; z-index: 2; }
.legacy-site .hero.hero-carousel .hero-carousel-controls { z-index: 8; }
.legacy-site .hero.hero-carousel .hero-slide-arrow { box-shadow: 0 8px 24px rgba(0,0,0,.2); }
.legacy-site .hero.hero-carousel .hero-slide-dot { flex: 0 0 auto; }
@media (prefers-reduced-motion: reduce) { .legacy-site .hero.hero-carousel .hero-slides > .hero-slide { transition-duration: .01ms; } }
`;


// CB_CLIENT_LOGO_PINGPONG_V1
function installClientLogoMarquee(root: HTMLElement) {
  const section = root.querySelector<HTMLElement>("#partners");
  const track = section?.querySelector<HTMLElement>(".client-logo-grid");

  if (!section || !track) return () => {};

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let direction = 1;
  let frame = 0;
  let previousTime = 0;
  let paused = false;
  let destroyed = false;

  const maxScroll = () =>
    Math.max(0, track.scrollWidth - track.clientWidth);

  const stop = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  };

  const tick = (time: number) => {
    if (destroyed || paused || document.hidden || reducedMotion.matches) {
      stop();
      return;
    }

    if (!previousTime) previousTime = time;

    const delta = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;

    const max = maxScroll();

    if (max > 1) {
      let next = track.scrollLeft + direction * 38 * delta;

      if (next >= max) {
        next = max;
        direction = -1;
      } else if (next <= 0) {
        next = 0;
        direction = 1;
      }

      track.scrollLeft = next;
    }

    frame = window.requestAnimationFrame(tick);
  };

  const start = () => {
    if (destroyed || paused || document.hidden || reducedMotion.matches) return;
    if (!frame) frame = window.requestAnimationFrame(tick);
  };

  const pause = () => {
    paused = true;
    stop();
  };

  const resume = () => {
    paused = false;
    start();
  };

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const onMotionChange = () => {
    if (reducedMotion.matches) stop();
    else start();
  };

  track.addEventListener("mouseenter", pause);
  track.addEventListener("mouseleave", resume);
  track.addEventListener("focusin", pause);
  track.addEventListener("focusout", resume);
  track.addEventListener("pointerdown", pause, { passive: true });
  track.addEventListener("pointerup", resume, { passive: true });
  track.addEventListener("pointercancel", resume, { passive: true });

  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotionChange);
  window.addEventListener("resize", start);

  start();

  return () => {
    destroyed = true;
    stop();

    track.removeEventListener("mouseenter", pause);
    track.removeEventListener("mouseleave", resume);
    track.removeEventListener("focusin", pause);
    track.removeEventListener("focusout", resume);
    track.removeEventListener("pointerdown", pause);
    track.removeEventListener("pointerup", resume);
    track.removeEventListener("pointercancel", resume);

    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotionChange);
    window.removeEventListener("resize", start);
  };
}

export default function LegacyDocument({ body, styles, links, scripts, title }: Props) {
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
        ? "/original/assets/clear-robotics-logo.png"
        : "/original/assets/home-hero-waterway-cleanup.jpg";
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

    // Remove all floating Call / WhatsApp controls, including their rails.
    const removeLegacyFloatingActions = () => {
      document.querySelectorAll<HTMLElement>(
        ".quick-contact-rail, .floating-contact-rail, .floating-contact-container, .whatsapp-float, .call-float"
      ).forEach((node) => node.remove());

      document.querySelectorAll<HTMLAnchorElement>(".legacy-site a[href]").forEach((link) => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        const cls = (link.className || "").toString().toLowerCase();
        const isCallOrWhatsApp =
          href.startsWith("tel:") ||
          href.includes("wa.me") ||
          href.includes("whatsapp") ||
          href.includes("api.whatsapp");

        const floatingClass = /float|fixed|whatsapp|quick-contact|call-contact/.test(cls);
        const floatingParent = !!link.closest(
          ".quick-contact-rail, .floating-contact-rail, .floating-contact-container, .floating-contact, .quick-contact-link"
        );
        const fixedStyle = /position\s*:\s*fixed/i.test(link.getAttribute("style") || "");

        if (isCallOrWhatsApp && (floatingClass || floatingParent || fixedStyle)) {
          link.remove();
        }

        if (href.includes("assessment")) link.remove();
      });
    };

    removeLegacyFloatingActions();

    // Remove controls injected later by page scripts as well.
    const floatingActionsObserver = new MutationObserver(() => {
      removeLegacyFloatingActions();
    });
    floatingActionsObserver.observe(document.body, { childList: true, subtree: true });

    // Keep a short contact form directly on every legacy page, not only Contact.
    const legacyRoot = document.querySelector<HTMLElement>(".legacy-site");
    const cleanupHeroCarousel = legacyRoot ? installLegacyHeroCarousel(legacyRoot) : undefined;
    const cleanupClientLogoMarquee = legacyRoot ? installClientLogoMarquee(legacyRoot) : undefined;
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

    // Add a separate optional comments field to every public enquiry form.
    legacyRoot?.querySelectorAll<HTMLFormElement>("form[data-enquiry-form]").forEach((form) => {
      if (form.querySelector('textarea, [name="comments"]')) return;
      const field = document.createElement("label");
      field.className = "cb-comment-suggestion-field";
      field.innerHTML = '<span>Any comments or suggestions? <small>(Optional)</small></span><textarea name="comments" rows="3" maxlength="3000" placeholder="Share any additional comments, questions or suggestions..."></textarea>';
      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitButton && submitButton.parentNode) {
        submitButton.parentNode.insertBefore(field, submitButton);
      } else {
        form.appendChild(field);
      }
    });

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
      const phoneNumber = pickField(raw, "Phone Number", "Phone", "Mobile", "Mobile Number", "Telephone", "Contact Number", "phone");
      const phoneCountryCode = pickField(raw, "Phone Country Code", "Country Calling Code", "Dial Code");
      const phone = phoneNumber
        ? (phoneNumber.trim().startsWith("+") ? phoneNumber : `${phoneCountryCode} ${phoneNumber}`.trim())
        : "";
      const company = pickField(raw, "Company Name", "Company", "Organisation", "Organization", "Organisation Name", "company");
      const jobTitle = pickField(raw, "Job Title", "Designation", "Role", "Position", "jobTitle");
      const country = pickField(raw, "Country", "country");
      const region = pickField(raw, "State / Region", "State", "Region", "City", "Location", "region");
      const industry = pickField(raw, "Industry", "Sector", "Business Type", "industry");
      const useCase = pickField(raw, "Use Case", "Message", "Project Details", "Enquiry", "Enquiry Details", "Requirements", "How can we help", "useCase");

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
        fullName, email, phone, company, jobTitle, country, region, industry, useCase, comments: pickField(raw, "comments"),
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
        // The homepage carousel is React-controlled. Never attach the older DOM controller too.
        if (item.id === "clearbot-home-hero-carousel-init") continue;
        if (item.code && item.code.includes("initialiseClearbotHeroCarousel")) continue;
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
      floatingActionsObserver.disconnect();
      cleanupHeroCarousel?.();
      cleanupClientLogoMarquee?.();
      legacyImages.forEach((img) => img.removeEventListener("error", imageFallback));
      document.removeEventListener("submit", submitEnquiry, true);
      addedBlogNodes.forEach((node) => node.remove());
      nodes.forEach((node) => node.remove());
    };
  }, [scripts]);


  return (
    <>
      {links.map((href, i) => <link key={`${href}-${i}`} rel="stylesheet" href={href} />)}
      <style id="cb-hide-floating-contact-before-paint">{`
        .legacy-site .floating-contact-rail,
        .legacy-site .floating-contact,
        .legacy-site .quick-contact-rail,
        .legacy-site .quick-contact-link,
        .legacy-site .floating-contact-container,
        .legacy-site .whatsapp-float,
        .legacy-site .call-float {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
      {styles.map((css, i) => <style key={i} dangerouslySetInnerHTML={{ __html: css }} />)}
      <div className="legacy-site" dangerouslySetInnerHTML={{ __html: body }} />
      <style id="cb-dom-hero-slide-motion" dangerouslySetInnerHTML={{ __html: LEGACY_HERO_SLIDER_CSS }} />
      <PremiumEffects/>
    </>
  );
}

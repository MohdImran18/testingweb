"use client";
import { useEffect } from "react";
import PremiumEffects from "./PremiumEffects";
import AssessmentCTA from "./AssessmentCTA";

type Props = {
  body: string;
  styles: string[];
  links: string[];
  scripts: { src?: string; code?: string; id?: string; type?: string }[];
  title: string;
};

export default function LegacyDocument({ body, styles, links, scripts, title }: Props) {
  useEffect(() => {
    const nodes: HTMLScriptElement[] = [];
    let cancelled = false;

    // One shared handler wires every enquiry/contact form on every legacy page
    // to the same backend. Capture phase prevents older mailto-only handlers
    // from taking over the submit event.
    const submitEnquiry = async (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      if (!target.matches('form')) return;
      const hasSubmit = target.querySelector('button[type="submit"], input[type="submit"]');
      if (!hasSubmit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!target.reportValidity()) return;

      const button = hasSubmit as HTMLButtonElement | HTMLInputElement;
      const originalLabel = button instanceof HTMLInputElement ? button.value : button.textContent || 'Submit';
      button.disabled = true;
      if (button instanceof HTMLInputElement) button.value = 'Submitting…';
      else button.textContent = 'Submitting…';

      let feedback = target.querySelector<HTMLElement>('[role="status"], .form-feedback, .form-message, .form-status');
      if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'form-feedback';
        feedback.setAttribute('role', 'status');
        target.appendChild(feedback);
      }
      feedback.style.display = 'block';
      feedback.textContent = 'Sending your enquiry…';

      const raw: Record<string, string> = {};
      new FormData(target).forEach((value, key) => { raw[key] = String(value).trim(); });
      const pick = (...keys: string[]) => {
        for (const key of keys) {
          const found = Object.entries(raw).find(([name]) => name.toLowerCase() === key.toLowerCase());
          if (found?.[1]) return found[1];
        }
        return '';
      };
      const payload = {
        fullName: pick('Full Name', 'Name', 'Your Name', 'Contact Name', 'fullName'),
        email: pick('Business Email', 'Email', 'Email Address', 'Work Email', 'email'),
        phone: pick('Phone Number', 'Phone', 'Mobile', 'Telephone', 'phone'),
        company: pick('Company Name', 'Company', 'Organisation', 'Organization', 'company'),
        jobTitle: pick('Job Title', 'Designation', 'Role', 'jobTitle'),
        country: pick('Country', 'country'),
        region: pick('State / Region', 'State', 'Region', 'City', 'Location', 'region'),
        industry: pick('Industry', 'Sector', 'industry'),
        useCase: pick('Use Case', 'Message', 'Project Details', 'Enquiry', 'Requirements', 'Comments', 'useCase'),
        sourcePage: window.location.pathname,
        formId: target.id || '',
        formType: target.getAttribute('data-enquiry-type') || 'website-enquiry',
        formFields: raw,
        consent: target.querySelector<HTMLInputElement>('input[type="checkbox"][name*="consent" i]')?.checked || false
      };

      try {
        const response = await fetch('/api/enquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'We could not submit your enquiry. Please try again.');
        feedback.textContent = `Thank you. Your enquiry has been received successfully. Reference: ${String(result.enquiryId || '').slice(0, 8).toUpperCase()}. Our team will contact you.`;
        target.reset();
      } catch (error) {
        feedback.textContent = error instanceof Error ? error.message : 'Unable to submit your enquiry. Please try again.';
      } finally {
        button.disabled = false;
        if (button instanceof HTMLInputElement) button.value = originalLabel;
        else button.textContent = originalLabel;
      }
    };
    document.addEventListener('submit', submitEnquiry, true);

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
      document.removeEventListener('submit', submitEnquiry, true);
      nodes.forEach((node) => node.remove());
    };
  }, [scripts]);

  return (
    <>
      <title>{title}</title>
      {links.map((href, i) => <link key={`${href}-${i}`} rel="stylesheet" href={href} />)}
      {styles.map((css, i) => <style key={i} dangerouslySetInnerHTML={{ __html: css }} />)}
      <div className="legacy-site" dangerouslySetInnerHTML={{ __html: body }} />
      <AssessmentCTA />
      <PremiumEffects />
    </>
  );
}

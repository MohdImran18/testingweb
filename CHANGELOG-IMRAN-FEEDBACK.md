# Clearbot website feedback implementation

## Website changes
- Home page uses one hero slide with a real deployment photo, adds an introductory YouTube video, keeps the Projects and Fleet sections, removes the Solutions/Services home section and the generic waterway-sector tiles, and presents the existing client logos in a horizontal scrolling strip.
- Contact page is reduced to Full Name, Business Email and Phone Number. The old process, contact-details and bottom conversion panels are removed. The existing enquiry API continues to save the lead and send the configured email notification.
- About page removes the team section and Umiam references, adds a field video and a Locations section, updates the Vision/Mission copy, and simplifies the milestone timeline into horizontally scrollable highlights.
- Project detail pages embed the corresponding YouTube video identified by the existing YouTube thumbnail already used on that page. Project links are larger.
- Product pages use consistent Class 2 Skimmer terminology and remove the capability matrix / deployment-step sections shown in the feedback reference.
- News now redirects to the single Insights page (`/blog.html`). Published CMS posts continue to be added to the listing from Admin.
- The floating Assessment CTA and its route/component have been removed. The website cleanup also removes old Assessment links and floating WhatsApp/Call actions.
- Footer contact links point to `/contact.html#contact-form`.

## Dynamic image management
- Added Admin → Image manager for Marketing and Super Admin users.
- Inventory contains 145 image slots across 30 legacy HTML pages, including embedded data-URL images.
- Each slot shows the source page, preview, and the image's natural pixel dimensions when loaded. Admin can upload a JPG, PNG, WEBP or GIF up to 5 MB, replace the image, or restore the original.
- Replacements are stored through the existing media upload store and mapped in `siteImages` records. PostgreSQL deployments persist mappings in the existing `admin_records` table; local development uses `data/admin-store.json`.
- `data/site-image-manifest.json` is required at runtime and must be retained.

## Verification
- `node --check server.js` passed.
- `tsc --noEmit` passed.
- Public image mapping endpoint was started locally and returned successfully.
- A full Next.js production build could not be run in this Linux container because the supplied dependency archive contains the Windows SWC binary only and network access to fetch the Linux SWC binary was unavailable. Run `npm ci` and `npm run build` in the target Windows/Render environment before deployment.

## Deployment note
For production image persistence, keep the Render PostgreSQL `DATABASE_URL` configured. The local JSON fallback is for development only. Configure SMTP environment variables for actual email forwarding from the three-field Contact form.


## Homepage hero carousel repair (18 November 2026)
- Fixed the root cause of the non-working hero carousel: the homepage had five pagination dots and navigation controls, but only one actual `data-hero-slide` article. The old initializer correctly returned early when fewer than two slides existed.
- Added five full hero slides using the five local homepage hero images already present in `public/assets`.
- Added matching slide copy and relevant links for the homepage, Alligator Neo, Class 2 fleet, Class 3 and global projects.
- Replaced the initializer with a ready-state-safe script that runs correctly when legacy scripts are dynamically inserted by the Next.js `LegacyDocument` component.
- Autoplay advances every 5 seconds; next/previous buttons, pagination dots, swipe navigation and hidden-tab timer handling are enabled.
- Preserved the requested 2/3 text + 1/3 YouTube video layout and its responsive stacking on mobile.
- Regenerated `data/site-image-manifest.json` against the current served HTML so the five hero images have valid Admin Image Manager slots. Total slots: 149.
- Validation: 5 slides / 5 dots, video layout CSS and 16:9 aspect ratio confirmed; `node --check` passed for the carousel initializer. A full Next.js build was not rerun in this container.

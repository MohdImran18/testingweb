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

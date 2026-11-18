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


## Homepage video emphasis and section reorder (18 November 2026)
- Reworked the homepage intro section to give the YouTube video approximately 75% of the content width and the text copy 25%, with the text on the left and video on the right.
- Reduced heading/body typography in the narrow copy column to keep it balanced.
- Reordered the homepage so “See Clearbot in Action” appears before “Global Presence”; the former lower section is now above the latter.
- Kept the responsive stacked layout on mobile and preserved the five-slide hero carousel.


## Hero carousel reliability fix (18 November 2026)
- Moved homepage hero-carousel initialization from an inline script embedded in legacy HTML into `LegacyDocument.tsx` React `useEffect`, which runs after the legacy DOM has mounted.
- Removed the old inline initializer from the served homepage and filtered legacy carousel scripts from dynamic script injection to prevent duplicate controllers.
- Next / Previous controls, five pagination dots, touch swipe and 5-second autoplay are wired directly to the mounted carousel DOM. Autoplay pauses only while the document is hidden and resumes when visible.
- Preserved the 5 homepage slide articles and local slide imagery, and preserved the 25% text / 75% YouTube layout.
- Verified 5 slides, 5 dots, video-section order above Global Presence, 25/75 CSS grid, and TypeScript `tsc --noEmit` passing.
- Full Next.js build could not run in this Linux container because the available dependency bundle lacks the Linux SWC binary and npm registry access is unavailable.


## Admin image manager — page-wise library (18 November 2026)
- Reorganised the Image Manager into page-wise sections, ordered from Homepage down through About, Projects, Fleet/Product pages, Services, individual project pages, Insights and Contact. Images within each page retain their original top-to-bottom order from the served HTML.
- Each page header shows its page number, readable page name, route, total image-slot count and preview-load progress.
- Added search across page name, alt text and source filename.
- Each image card shows the image preview, source filename, position within its page, natural pixel dimensions, aspect ratio, file size when same-origin or embedded metadata is available, and image format. External CDN assets are clearly labelled when browser security prevents reading their exact byte size.
- Fixed preview URL handling for `data:image/...` embedded images so they render directly instead of being incorrectly treated as a root-relative file path.
- Kept image replacement and restore-original actions on every image card.
- Validation: TypeScript/TSX transpilation reports zero syntax diagnostics; manifest parses with 149 slots across 30 pages. Full Next.js build could not be run because dependency installation timed out in this environment.


## Homepage slider + image manager correction (18 November 2026)
- Rebuilt the homepage hero carousel as a React-controlled component instead of relying on direct DOM event listeners attached by a legacy `useEffect`. React state controls the active slide, arrows and dots; autoplay advances every five seconds; hover/focus pauses autoplay; touch swipe is supported on mobile.
- The route extracts the five slide articles from the served homepage HTML and renders them through the React carousel. This avoids the timing/race problem of initializing controls against injected legacy HTML.
- Upgraded the Alligator Neo, Class 2 and Class 3 hero slide sources to their bundled 1920 × 900 px original assets. Waterway cleanup and Fetch remain 1200 × 630 px sources and are flagged as below the recommended hero size.
- Image Manager now has a dedicated **Homepage Hero Slider** group with five named cards. Each card identifies its slide and shows current uploaded dimensions, recommended size, file size, format and a resolution status. Slider replacement in Admin still maps to the corresponding homepage image slot.
- Recommended homepage hero image dimensions: 1920 × 900 px (wide landscape). Actual current bundled dimensions are listed in `README-ADMIN.md`.
- Validation: TypeScript `tsc --noEmit` passed; static checks confirmed five carousel slides, five matching image-manifest records, local image files and the React-based controls. A full Next.js build was not completed in this Linux container because the available dependency set does not include the Linux SWC binary; run `npm ci` and `npm run build` in the target Windows/Render environment before deployment.


## Contact page follow-up copy update
- Replaced the old “Schedule a Call” / “Contact us – Virtual demos – Get Clearbot” block with a Clearbot project enquiry process.
- Replaced the social-follow panel with “What to include in your enquiry” guidance.
- Updated the lower CTA to “Start an enquiry” linking back to the three-field contact form.
- Updated Contact page title and Open Graph copy.


## Contact page simplification (18 Nov 2026)
- Removed the left-side “LET'S START A CONVERSATION” headline, supporting paragraph, reply-time promise, and direct corporate email block from the contact hero.
- Retained the three-field enquiry form (Full Name, Business Email, Phone Number with country calling-code selector).
- Retained the “Your Project, Our Process” section and its three process cards.
- Removed the extra direct-contact/help panels and bottom CTA from the contact page.
- Centered the enquiry form and adjusted responsive spacing.

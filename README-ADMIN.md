# Clearbot Admin Management System

This update adds a secure admin panel to the existing Next.js 16 + Node.js Clearbot website.

## Modules

- `/admin/login` and `/admin`: signed-cookie admin authentication and dashboard.
- Lead management: website enquiries plus manual phone, email, WhatsApp, event, LinkedIn and referral leads; status, assignment, follow-up, notes and CSV export.
- Email alerts: new website and manually entered leads notify `ENQUIRY_NOTIFY_TO` (defaults to `sid@clearbot.org`) through SMTP.
- Blog CMS: rich content editing, image upload, categories, tags, drafts, publish/schedule status and article SEO.
- SEO manager: page titles, descriptions, keywords, canonical, robots directives and Open Graph metadata. Page metadata is resolved at request time.
- Team access: `super_admin`, `sales` and `marketing` roles.
- Published CMS blogs appear on `/blog.html`, render at `/blog/<slug>`, and are included in the generated sitemap.

## Local setup

1. Run `npm install` after applying this update.
2. Copy `.env.example` to `.env` and set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters), and `SESSION_SECRET`.
3. For local testing, leave `DATABASE_URL` empty; the API uses `data/admin-store.json`. This is only a local-development fallback.
4. Add SMTP credentials to `.env` to send real email notifications.
5. Run `npm run dev` and open `http://localhost:3001/admin/login`.

The existing `data/enquiries.json` file is retained. On startup, its records are migrated into the admin lead store (PostgreSQL when configured, otherwise the local development JSON store).

## Render production setup (required before using real leads)

Create a PostgreSQL database in Render and link its **Internal Database URL** as `DATABASE_URL` on the Clearbot Web Service. Add these Web Service environment variables:

- `ADMIN_EMAIL`: the chosen Super Admin login email.
- `ADMIN_PASSWORD`: a strong unique password of at least 12 characters.
- `ADMIN_NAME`: admin display name.
- `SESSION_SECRET`: a random secret (generate locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- `DATABASE_URL`: Render PostgreSQL Internal Database URL.
- `DATABASE_SSL=true` (unless Render's database instructions specify otherwise).
- `ENQUIRY_NOTIFY_TO=sid@clearbot.org`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: valid SMTP credentials from the organisation's mail provider.
- `NEXT_PUBLIC_SITE_URL`: the final public website URL.

The admin API creates the required database tables at startup and migrates entries from `data/enquiries.json` on first connection. Do not remove the source JSON until migration has been verified.

## Important deployment notes

- Never commit `.env`, database URLs, SMTP passwords or real admin passwords.
- Render's free web filesystem is ephemeral. Configure PostgreSQL before collecting live business enquiries. Blog images are stored in PostgreSQL when it is configured.
- Without SMTP variables, enquiry records still save, but email status is `not_configured`; the app does not claim that an email was sent.
- Admin login is protected by a 12-hour HTTP-only, SameSite cookie. Production login requires `SESSION_SECRET`.
- Role permissions: Super Admin (all modules), Sales (leads), Marketing (blogs and SEO).

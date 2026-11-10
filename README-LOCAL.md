# Clearbot Premium Website — Next.js Full-Stack Local Setup

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 (PostCSS)
- Framer Motion and Lucide React dependencies for new interactive components
- Existing Node.js API preserved on port 3000
- Next.js frontend on port 3001, with `/api/*` proxied to the existing API

## Requirements
- Node.js 20.9+ (Node 22 LTS recommended)
- npm 10+

## Run locally
1. Extract this ZIP.
2. Open a terminal in `Clearbot_Premium_Final_Website`.
3. Install dependencies: `npm install`
4. Start frontend and API together: `npm run dev`
5. Open **http://localhost:3001**.

The API health check is available at `http://localhost:3001/api/health` (proxied to port 3000).

## Production build
- `npm run build`
- `npm start`
- Frontend: http://localhost:3001
- API: http://localhost:3000

## URL and content preservation
All 30 original HTML pages are routed at their original `.html` paths through the Next.js app. Original page content, images, asset paths, internal links, external links, metadata titles, embedded styles, and inline scripts are retained. Source copies are in `public/original/`; images are in `public/assets/`.

## Enquiries
The contact form now submits to the existing `/api/enquiries` endpoint. The preserved Node.js API validates and stores enquiries in `data/enquiries.json`. The GET endpoint is for local development only and must be protected before public deployment.

## Notes
- Existing public-facing WhatsApp number in the source content is +852 5138 5925; confirm before publishing.
- This build preserves the existing backend and JSON enquiry storage. No MySQL database was introduced.
- External video/media embeds and hosted font resources may require an internet connection.


## Project Assessment Calculator
- Open `http://localhost:3001/assessment` or use the floating **Project Assessment** link on existing pages.
- The four-step form captures waterbody type, cleaning requirements, project location/scale, and contact details.
- Submissions are sent to the existing `POST /api/enquiries` endpoint and stored in `data/enquiries.json` by the existing Node.js service.
- Assessment fields are stored alongside the existing enquiry fields; the existing API and JSON storage remain in place.
- The callback confirmation is shown only after the API confirms the enquiry was saved.

## Website enquiry form integration
All HTML enquiry forms are wired through one shared submit handler in `components/LegacyDocument.tsx` and submit to `POST /api/enquiries`. The contact form no longer relies on opening the visitor's email application. The project assessment form also submits to the same API. Each record stores the source page, form ID/type and submitted field values in `data/enquiries.json`. The API requires a valid name, email and phone; other organisation/project fields are optional to support shorter forms.

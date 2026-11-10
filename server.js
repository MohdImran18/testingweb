const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'enquiries.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 32 * 1024;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp', '.xml':'application/xml; charset=utf-8', '.ico':'image/x-icon' };

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]\n');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function readEnquiries() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''; req.on('data', chunk => { body += chunk; if (body.length > MAX_BODY) { reject(new Error('Request body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok', service: 'Clearbot website API' });

  if (url.pathname === '/api/enquiries' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const enquiry = {
        id: crypto.randomUUID(), createdAt: new Date().toISOString(),
        fullName: clean(body.fullName, 120), email: clean(body.email, 254).toLowerCase(),
        phone: clean(body.phone, 40), company: clean(body.company, 160),
        jobTitle: clean(body.jobTitle, 120), country: clean(body.country, 100),
        region: clean(body.region, 100), industry: clean(body.industry, 120),
        waterbodyType: clean(body.waterbodyType, 100),
        cleaningNeeds: Array.isArray(body.cleaningNeeds) ? body.cleaningNeeds.map(item => clean(item, 120)).slice(0, 10) : [],
        waterbodyName: clean(body.waterbodyName, 200),
        area: clean(body.area, 40), areaUnit: clean(body.areaUnit, 40),
        projectTimeline: clean(body.projectTimeline, 100),
        projectDetails: clean(body.projectDetails, 3000),
        consent: body.consent === true,
        useCase: clean(body.useCase, 5000),
        sourcePage: clean(body.sourcePage, 300),
        formId: clean(body.formId, 120),
        formType: clean(body.formType, 120) || 'website-enquiry',
        formFields: body.formFields && typeof body.formFields === 'object' && !Array.isArray(body.formFields)
          ? Object.fromEntries(Object.entries(body.formFields).slice(0, 40).map(([key, value]) => [clean(key, 120), clean(value, 2000)]))
          : {},
        status: 'new'
      };
      // Name, email and phone identify the lead; remaining organisation/project
      // fields are optional so shorter forms on other pages can also submit.
      const required = ['fullName','email','phone'];
      const missing = required.filter(key => !enquiry[key]);
      if (missing.length) return json(res, 400, { error: 'Please complete all required fields.', fields: missing });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) return json(res, 400, { error: 'Please enter a valid email address.' });
      if (enquiry.phone.replace(/\D/g, '').length < 6) return json(res, 400, { error: 'Please enter a valid phone number.' });
      const records = readEnquiries(); records.unshift(enquiry);
      fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2) + '\n');
      return json(res, 201, { message: 'Thank you. Your project enquiry has been received.', enquiryId: enquiry.id });
    } catch (error) {
      return json(res, error.message === 'Invalid JSON body' ? 400 : 413, { error: error.message || 'Unable to process enquiry.' });
    }
  }

  if (url.pathname === '/api/enquiries' && req.method === 'GET') {
    // Local development convenience only. Protect this endpoint before public deployment.
    const records = readEnquiries();
    return json(res, 200, { total: records.length, enquiries: records });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid URL' }); }
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.resolve(ROOT, '.' + pathname);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) return json(res, 403, { error: 'Forbidden' });
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return json(res, 404, { error: 'Page not found' });
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => console.log(`Clearbot local website: http://${HOST}:${PORT}\nAPI health: http://${HOST}:${PORT}/api/health\nEnquiries are stored in data/enquiries.json`));

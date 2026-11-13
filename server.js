const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch { nodemailer = null; }
let Pool;
try { ({ Pool } = require('pg')); } catch { /* pg is installed by package.json */ }

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const ENQUIRIES_FILE = path.join(DATA_DIR, 'enquiries.json');
const STORE_FILE = path.join(DATA_DIR, 'admin-store.json');
const API_PORT = Number(process.env.API_PORT || 3000);
const HOST = '127.0.0.1';
const MAX_BODY = 8 * 1024 * 1024;
const SESSION_TTL = 12 * 60 * 60 * 1000;
const NOTIFY_TO = process.env.ENQUIRY_NOTIFY_TO || 'sid@clearbot.org';
const scrypt = promisify(crypto.scrypt);
const databaseUrl = process.env.DATABASE_URL || '';
const useDatabase = Boolean(databaseUrl && Pool);
const pool = useDatabase ? new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: 5 }) : null;
const sessionSecret = process.env.SESSION_SECRET || 'clearbot-local-development-secret-change-before-production';
const loginAttempts = new Map();
const mailConfigured = Boolean(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = mailConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ENQUIRIES_FILE)) fs.writeFileSync(ENQUIRIES_FILE, '[]\n');
if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ users: [], leads: [], blogs: [], categories: [], seo: [], activity: [], media: [] }, null, 2));

function json(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
  res.end(JSON.stringify(payload));
}
function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function safeSlug(value) { return clean(value, 180).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''; let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) { failed = true; reject(new Error('Request body too large')); req.resume(); }
    });
    req.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
function readJsonFile(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function readFallbackStore() { return readJsonFile(STORE_FILE, { users: [], leads: [], blogs: [], categories: [], seo: [], activity: [], media: [] }); }
function writeFallbackStore(store) { fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2) + '\n'); }

async function initStorage() {
  if (!useDatabase) {
    const legacy = readJsonFile(ENQUIRIES_FILE, []);
    if (Array.isArray(legacy)) {
      const known = new Set((await listRecords('leads')).map(item => item.id));
      for (const item of legacy) { const id = clean(item.id, 80) || crypto.randomUUID(); if (!known.has(id)) await putRecord('leads', { ...item, id, source: item.source || 'website', status: item.status || 'new' }); }
    }
    console.log('Admin storage: local JSON fallback (configure DATABASE_URL for persistent production storage).');
    return;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_records (
    id TEXT PRIMARY KEY, collection TEXT NOT NULL, data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS admin_records_collection_idx ON admin_records(collection, created_at DESC)');
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx ON admin_records ((lower(data->>'email'))) WHERE collection = 'users'`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS admin_blogs_slug_idx ON admin_records ((data->>'slug')) WHERE collection = 'blogs'`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_media (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime_type TEXT NOT NULL, data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  // Preserve and migrate any enquiries already collected in the local JSON file.
  const legacy = readJsonFile(ENQUIRIES_FILE, []);
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      const id = clean(item.id, 80) || crypto.randomUUID();
      await pool.query(`INSERT INTO admin_records(id, collection, data) VALUES($1, 'leads', $2::jsonb) ON CONFLICT(id) DO NOTHING`, [id, JSON.stringify({ ...item, id, source: item.source || 'website', status: item.status || 'new' })]);
    }
  }
  // If a local development store is deliberately copied to production during migration, preserve its records too.
  const localStore = readJsonFile(STORE_FILE, {});
  for (const collection of ['leads','blogs','categories','seo','activity','users']) {
    for (const item of (Array.isArray(localStore[collection]) ? localStore[collection] : [])) {
      if (!item?.id) continue;
      await pool.query('INSERT INTO admin_records(id, collection, data) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING', [item.id, collection, JSON.stringify(item)]);
    }
  }
  for (const item of (Array.isArray(localStore.media) ? localStore.media : [])) {
    if (!item?.id || !item?.data) continue;
    await pool.query('INSERT INTO admin_media(id,filename,mime_type,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [item.id, item.filename || 'blog-image', item.mimeType || 'image/jpeg', Buffer.from(item.data, 'base64')]);
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (String(process.env.ADMIN_PASSWORD).length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    const existing = await findUserByEmail(process.env.ADMIN_EMAIL.toLowerCase());
    if (!existing) {
      const user = { id: crypto.randomUUID(), email: process.env.ADMIN_EMAIL.toLowerCase(), name: process.env.ADMIN_NAME || 'Clearbot Super Admin', role: 'super_admin', active: true, passwordHash: await hashPassword(process.env.ADMIN_PASSWORD), createdAt: new Date().toISOString() };
      await putRecord('users', user);
      console.log(`Initial super admin created for ${user.email}`);
    }
  }
  console.log('Admin storage: PostgreSQL connected and schema ready.');
}

async function listRecords(collection) {
  if (useDatabase) {
    const { rows } = await pool.query('SELECT data FROM admin_records WHERE collection=$1 ORDER BY created_at DESC', [collection]);
    return rows.map(r => r.data);
  }
  const store = readFallbackStore();
  return Array.isArray(store[collection]) ? store[collection] : [];
}
async function getRecord(collection, id) {
  if (useDatabase) {
    const { rows } = await pool.query('SELECT data FROM admin_records WHERE collection=$1 AND id=$2 LIMIT 1', [collection, id]);
    return rows[0]?.data || null;
  }
  return (await listRecords(collection)).find(item => item.id === id) || null;
}
async function putRecord(collection, record) {
  if (useDatabase) {
    await pool.query(`INSERT INTO admin_records(id, collection, data, updated_at) VALUES($1,$2,$3::jsonb,NOW())
      ON CONFLICT(id) DO UPDATE SET collection=EXCLUDED.collection, data=EXCLUDED.data, updated_at=NOW()`, [record.id, collection, JSON.stringify(record)]);
    return record;
  }
  const store = readFallbackStore();
  store[collection] = Array.isArray(store[collection]) ? store[collection] : [];
  const index = store[collection].findIndex(item => item.id === record.id);
  if (index >= 0) store[collection][index] = record; else store[collection].unshift(record);
  writeFallbackStore(store);
  return record;
}
async function saveLeadRecord(lead) {
  await putRecord('leads', lead);
  // Keep the original enquiries.json export in sync during local development.
  // The Admin store remains the primary source; database deployments use PostgreSQL.
  if (!useDatabase) {
    const existing = readJsonFile(ENQUIRIES_FILE, []);
    const records = Array.isArray(existing) ? existing : [];
    const index = records.findIndex(item => item && item.id === lead.id);
    if (index >= 0) records[index] = lead;
    else records.unshift(lead);
    fs.writeFileSync(ENQUIRIES_FILE, JSON.stringify(records, null, 2) + '\n');
  }
  return lead;
}
async function deleteRecord(collection, id) {
  if (useDatabase) { await pool.query('DELETE FROM admin_records WHERE collection=$1 AND id=$2', [collection, id]); return; }
  const store = readFallbackStore();
  store[collection] = (store[collection] || []).filter(item => item.id !== id);
  writeFallbackStore(store);
}
async function findUserByEmail(email) {
  return (await listRecords('users')).find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${Buffer.from(key).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  try {
    const [scheme, salt, key] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !key) return false;
    const derived = Buffer.from(await scrypt(String(password), salt, 64));
    const expected = Buffer.from(key, 'hex');
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch { return false; }
}
function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_TTL })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function verifySession(token) {
  try {
    const [payload, signature] = String(token).split('.');
    const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.exp > Date.now() ? parsed.sub : null;
  } catch { return null; }
}
function cookies(req) {
  const output = {};
  for (const item of String(req.headers.cookie || '').split(';')) {
    const index = item.indexOf('='); if (index > 0) output[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
  }
  return output;
}
async function requireUser(req, res, roles = null) {
  const token = cookies(req).cb_admin_session;
  const userId = token && verifySession(token);
  if (!userId) { json(res, 401, { error: 'Please sign in to continue.' }); return null; }
  const user = await getRecord('users', userId);
  if (!user || !user.active) { json(res, 401, { error: 'Your admin session is no longer active.' }); return null; }
  if (roles && !roles.includes(user.role)) { json(res, 403, { error: 'You do not have permission to perform this action.' }); return null; }
  return user;
}
async function logActivity(user, action, entity, entityId, meta = {}) {
  const record = { id: crypto.randomUUID(), userId: user?.id || null, userEmail: user?.email || 'system', action, entity, entityId: entityId || '', meta, createdAt: new Date().toISOString() };
  await putRecord('activity', record);
}
function safeUser(user) { return { id: user.id, email: user.email, name: user.name, role: user.role, active: user.active }; }
function htmlEscape(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function sanitizeHtml(input) {
  let html = String(input || '').slice(0, 500000);
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*\/?\s*>/gi, '');
  const allowedTags = new Set(['p','br','strong','b','em','i','u','h1','h2','h3','h4','ul','ol','li','blockquote','a','img','figure','figcaption','table','thead','tbody','tr','th','td','hr','span','div']);
  html = html.replace(/<\/?([a-z0-9-]+)\b([^>]*)>/gi, (whole, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase(); if (!allowedTags.has(tag)) return '';
    const closing = /^<\//.test(whole); if (closing) return `</${tag}>`;
    const attrs = []; const attrPattern = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g; let match;
    while ((match = attrPattern.exec(rawAttrs))) {
      const key = match[1].toLowerCase(); const value = match[2] ?? match[3] ?? match[4] ?? '';
      if (!['href','src','alt','title','target','rel','width','height'].includes(key)) continue;
      if ((key === 'href' || key === 'src') && !/^(https?:\/\/|\/|#|mailto:)/i.test(value)) continue;
      attrs.push(`${key}="${htmlEscape(value)}"`);
    }
    if (tag === 'a' && attrs.some(a => a.startsWith('target=')) && !attrs.some(a => a.startsWith('rel='))) attrs.push('rel="noopener noreferrer"');
    return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  });
  return html;
}

async function sendEnquiryEmail(enquiry, channel = 'Website') {
  if (!transporter) { console.warn('SMTP is not configured; enquiry saved but email notification was not sent.'); return false; }
  const fields = [
    ['Enquiry ID', enquiry.id], ['Received via', channel], ['Customer', enquiry.fullName], ['Company', enquiry.company],
    ['Email', enquiry.email], ['Phone', enquiry.phone], ['Job title', enquiry.jobTitle],
    ['Country', enquiry.country], ['Region / City', enquiry.region], ['Industry', enquiry.industry],
    ['Waterbody type', enquiry.waterbodyType], ['Cleaning needs', Array.isArray(enquiry.cleaningNeeds) ? enquiry.cleaningNeeds.join(', ') : ''],
    ['Waterbody name', enquiry.waterbodyName], ['Area', enquiry.area ? `${enquiry.area} ${enquiry.areaUnit || ''}` : ''],
    ['Project timeline', enquiry.projectTimeline], ['Project details', enquiry.projectDetails],
    ['Interest / message', enquiry.useCase || enquiry.projectDetails || enquiry.formType || 'General enquiry'],
    ['Form type', enquiry.formType], ['Form ID', enquiry.formId],
    ['Source page', enquiry.sourcePage || 'Manual entry'], ['Received at', enquiry.createdAt],
    ...Object.entries(enquiry.formFields || {}).slice(0, 40).map(([key, value]) => [`Form field: ${key}`, value]),
  ];
  const text = fields.map(([label, value]) => `${label}: ${value || '-'}`).join('\n');
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: NOTIFY_TO,
    subject: `New Clearbot enquiry: ${enquiry.fullName || 'New lead'} (${String(enquiry.id).slice(0, 8)})`,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px"><h2 style="color:#07566b">New Clearbot enquiry</h2><table cellpadding="9" cellspacing="0" style="border-collapse:collapse;width:100%">${fields.map(([label,value]) => `<tr><td style="background:#f2f7f8;border-bottom:1px solid #dae7e9;font-weight:bold;width:150px">${htmlEscape(label)}</td><td style="border-bottom:1px solid #dae7e9">${htmlEscape(value || '-')}</td></tr>`).join('')}</table><p style="color:#667">Open the Clearbot Admin Panel to manage this lead.</p></div>`,
  });
  return true;
}
function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cb_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL / 1000)}${secure}`);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `cb_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}
function leadFromPayload(body, source = 'website') {
  const cleanFields = body.formFields && typeof body.formFields === 'object' && !Array.isArray(body.formFields)
    ? Object.fromEntries(Object.entries(body.formFields).slice(0, 40).map(([key, value]) => [clean(key, 120), clean(value, 2000)])) : {};
  return {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    fullName: clean(body.fullName || body.name, 120), email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 40), company: clean(body.company, 160), jobTitle: clean(body.jobTitle, 120),
    country: clean(body.country, 100), region: clean(body.region, 100), industry: clean(body.industry, 120),
    waterbodyType: clean(body.waterbodyType, 100), cleaningNeeds: Array.isArray(body.cleaningNeeds) ? body.cleaningNeeds.map(v => clean(v,120)).slice(0,10) : [],
    waterbodyName: clean(body.waterbodyName, 200), area: clean(body.area, 40), areaUnit: clean(body.areaUnit, 40),
    projectTimeline: clean(body.projectTimeline, 100), projectDetails: clean(body.projectDetails, 3000),
    consent: body.consent === true, useCase: clean(body.useCase || body.message, 5000),
    sourcePage: clean(body.sourcePage, 300), formId: clean(body.formId, 120), formType: clean(body.formType, 120) || 'website-enquiry',
    formFields: cleanFields, source, status: 'new', assignedTo: '', followUpAt: '', notes: [], emailNotification: 'pending'
  };
}
function normalizeLeadUpdate(body, current) {
  const allowed = ['fullName','email','phone','company','jobTitle','country','region','industry','useCase','status','assignedTo','followUpAt','source','projectDetails'];
  const updated = { ...current, updatedAt: new Date().toISOString() };
  for (const key of allowed) if (body[key] !== undefined) updated[key] = clean(body[key], key === 'useCase' || key === 'projectDetails' ? 5000 : 1000);
  if (body.note && clean(body.note, 3000)) updated.notes = [...(Array.isArray(updated.notes) ? updated.notes : []), { id: crypto.randomUUID(), text: clean(body.note, 3000), createdAt: new Date().toISOString(), by: clean(body.noteBy, 160) }];
  return updated;
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') return json(res, 200, { status: 'ok', service: 'Clearbot website API', storage: useDatabase ? 'postgresql' : 'local-json', emailConfigured: Boolean(transporter) });

  if (method === 'POST' && pathname === '/api/enquiries') {
    try {
      const body = await readBody(req);
      const enquiry = leadFromPayload(body, 'website');
      if (!enquiry.fullName || !enquiry.email || !enquiry.phone) return json(res, 400, { error: 'Please complete your name, email and phone number.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) return json(res, 400, { error: 'Please enter a valid email address.' });
      if (enquiry.phone.replace(/\D/g, '').length < 6) return json(res, 400, { error: 'Please enter a valid phone number.' });
      await saveLeadRecord(enquiry);
      sendEnquiryEmail(enquiry, 'Website form').then(async sent => {
        const updated = await getRecord('leads', enquiry.id);
        if (updated) { updated.emailNotification = sent ? 'sent' : 'not_configured'; await saveLeadRecord(updated); }
      }).catch(async error => {
        console.error('Enquiry notification failed:', error.message);
        const updated = await getRecord('leads', enquiry.id);
        if (updated) { updated.emailNotification = 'failed'; await saveLeadRecord(updated); }
      });
      return json(res, 201, { message: 'Thank you. Your enquiry has been received.', enquiryId: enquiry.id });
    } catch (error) { return json(res, error.message === 'Invalid JSON body' ? 400 : error.message === 'Request body too large' ? 413 : 500, { error: error.message || 'Unable to process enquiry.' }); }
  }

  if (method === 'POST' && pathname === '/api/admin/auth/login') {
    try {
      if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) return json(res, 503, { error: 'Admin authentication is not configured. Set SESSION_SECRET in the service environment.' });
      const body = await readBody(req); const email = clean(body.email, 254).toLowerCase(); const password = String(body.password || '');
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const attempt = loginAttempts.get(ip) || { count: 0, started: Date.now() };
      if (Date.now() - attempt.started > 15 * 60 * 1000) { attempt.count = 0; attempt.started = Date.now(); }
      if (attempt.count >= 8) return json(res, 429, { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
      const user = await findUserByEmail(email);
      if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) { attempt.count += 1; loginAttempts.set(ip, attempt); return json(res, 401, { error: 'Email or password is incorrect.' }); }
      loginAttempts.delete(ip);
      setSessionCookie(res, signSession(user.id));
      await logActivity(user, 'login', 'auth', user.id);
      return json(res, 200, { user: safeUser(user) });
    } catch (error) { return json(res, 500, { error: error.message || 'Unable to sign in.' }); }
  }
  if (method === 'GET' && pathname === '/api/admin/auth/me') {
    const user = await requireUser(req, res); if (!user) return;
    return json(res, 200, { user: safeUser(user) });
  }
  if (method === 'POST' && pathname === '/api/admin/auth/logout') {
    const userId = verifySession(cookies(req).cb_admin_session || ''); const user = userId ? await getRecord('users', userId) : null;
    if (user) await logActivity(user, 'logout', 'auth', user.id);
    clearSessionCookie(res); return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/public/blogs') {
    const blogs = (await listRecords('blogs')).filter(b => b.status === 'published' || (b.status === 'scheduled' && b.publishAt && new Date(b.publishAt).getTime() <= Date.now())).sort((a,b) => String(b.publishAt || b.updatedAt).localeCompare(String(a.publishAt || a.updatedAt)));
    return json(res, 200, { blogs: blogs.map(({ content, ...item }) => item) });
  }
  if (method === 'GET' && pathname.startsWith('/api/public/blog/')) {
    const slug = decodeURIComponent(pathname.slice('/api/public/blog/'.length));
    const blog = (await listRecords('blogs')).find(b => b.slug === slug && (b.status === 'published' || (b.status === 'scheduled' && b.publishAt && new Date(b.publishAt).getTime() <= Date.now())));
    return blog ? json(res, 200, { blog }) : json(res, 404, { error: 'Blog not found.' });
  }
  if (method === 'GET' && pathname === '/api/public/seo') {
    const pagePath = clean(url.searchParams.get('path') || '/', 300);
    const seo = (await listRecords('seo')).find(item => item.path === pagePath);
    return json(res, 200, { seo: seo?.fields || null });
  }
  if (method === 'GET' && pathname.startsWith('/api/uploads/')) {
    const id = clean(pathname.slice('/api/uploads/'.length), 80);
    if (useDatabase) {
      const { rows } = await pool.query('SELECT filename,mime_type,data FROM admin_media WHERE id=$1', [id]);
      if (!rows[0]) return json(res, 404, { error: 'Image not found.' });
      res.writeHead(200, { 'Content-Type': rows[0].mime_type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      return res.end(rows[0].data);
    }
    const media = await getRecord('media', id);
    if (!media) return json(res, 404, { error: 'Image not found.' });
    const buffer = Buffer.from(media.data, 'base64');
    res.writeHead(200, { 'Content-Type': media.mimeType, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    return res.end(buffer);
  }

  if (pathname.startsWith('/api/admin/')) {
    const user = await requireUser(req, res); if (!user) return;
    const canLeads = ['super_admin','sales'].includes(user.role);
    const canContent = ['super_admin','marketing'].includes(user.role);
    const isSuper = user.role === 'super_admin';

    if (method === 'GET' && pathname === '/api/admin/settings') {
      return json(res, 200, { notifyTo: NOTIFY_TO, emailConfigured: Boolean(transporter), database: useDatabase ? 'PostgreSQL' : 'Local JSON (development only)', roles: ['super_admin','sales','marketing'] });
    }
    if (method === 'GET' && pathname === '/api/admin/dashboard') {
      const [leads, blogs] = await Promise.all([listRecords('leads'), listRecords('blogs')]);
      const counts = {}; for (const lead of leads) counts[lead.status || 'new'] = (counts[lead.status || 'new'] || 0) + 1;
      const today = new Date().toISOString().slice(0,10);
      return json(res, 200, { totalLeads: leads.length, newToday: leads.filter(l => String(l.createdAt || '').slice(0,10) === today).length, statuses: counts, totalBlogs: blogs.length, publishedBlogs: blogs.filter(b => b.status === 'published').length, drafts: blogs.filter(b => b.status === 'draft').length, recentLeads: canLeads ? leads.slice(0,8).map(({ notes, formFields, ...item }) => item) : [] });
    }
    if (pathname === '/api/admin/leads' && method === 'GET') {
      if (!canLeads) return json(res, 403, { error: 'Lead management permission required.' });
      let leads = await listRecords('leads');
      const status = clean(url.searchParams.get('status'), 50); const q = clean(url.searchParams.get('q'), 150).toLowerCase();
      if (status && status !== 'all') leads = leads.filter(l => l.status === status);
      if (q) leads = leads.filter(l => [l.fullName,l.email,l.company,l.country,l.phone].some(v => String(v || '').toLowerCase().includes(q)));
      return json(res, 200, { total: leads.length, leads });
    }
    if (pathname === '/api/admin/leads' && method === 'POST') {
      if (!canLeads) return json(res, 403, { error: 'Lead management permission required.' });
      const body = await readBody(req); const lead = leadFromPayload(body, clean(body.source, 60) || 'manual');
      if (!lead.fullName || !lead.email || !lead.phone) return json(res, 400, { error: 'Name, email and phone are required.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return json(res, 400, { error: 'Enter a valid email address.' });
      lead.emailNotification = 'pending';
      await saveLeadRecord(lead); await logActivity(user, 'created', 'lead', lead.id, { source: lead.source });
      sendEnquiryEmail(lead, 'Manual enquiry').then(async sent => { const v=await getRecord('leads',lead.id); if(v){v.emailNotification=sent?'sent':'not_configured'; await saveLeadRecord(v);} }).catch(async e=>{console.error('Manual enquiry email failed:',e.message); const v=await getRecord('leads',lead.id); if(v){v.emailNotification='failed'; await saveLeadRecord(v);} });
      return json(res, 201, { lead });
    }
    const leadMatch = pathname.match(/^\/api\/admin\/leads\/([^/]+)$/);
    if (leadMatch && method === 'PATCH') {
      if (!canLeads) return json(res, 403, { error: 'Lead management permission required.' });
      const id = decodeURIComponent(leadMatch[1]); const current = await getRecord('leads', id);
      if (!current) return json(res, 404, { error: 'Lead not found.' });
      const body = await readBody(req); const updated = normalizeLeadUpdate(body, current);
      await saveLeadRecord(updated); await logActivity(user, 'updated', 'lead', id, { status: updated.status });
      return json(res, 200, { lead: updated });
    }
    if (pathname === '/api/admin/blogs' && method === 'GET') {
      if (!canContent) return json(res, 403, { error: 'Content management permission required.' });
      const blogs = await listRecords('blogs'); return json(res, 200, { blogs });
    }
    if (pathname === '/api/admin/blogs' && method === 'POST') {
      if (!canContent) return json(res, 403, { error: 'Content management permission required.' });
      const body = await readBody(req); const title = clean(body.title, 220); const slug = safeSlug(body.slug || title);
      if (!title || !slug) return json(res, 400, { error: 'Blog title is required.' });
      if ((await listRecords('blogs')).some(b => b.slug === slug)) return json(res, 409, { error: 'This blog URL already exists. Choose another slug.' });
      const status = ['draft','published','scheduled'].includes(body.status) ? body.status : 'draft';
      const blog = { id: crypto.randomUUID(), title, slug, excerpt: clean(body.excerpt, 500), content: sanitizeHtml(body.content), featuredImage: clean(body.featuredImage, 800), imageAlt: clean(body.imageAlt, 300), category: clean(body.category, 100), tags: Array.isArray(body.tags) ? body.tags.map(v=>clean(v,60)).slice(0,20) : [], author: clean(body.author,120) || user.name, status, publishAt: clean(body.publishAt,80) || (status === 'published' ? new Date().toISOString() : ''), seo: body.seo && typeof body.seo === 'object' ? body.seo : {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await putRecord('blogs', blog); await logActivity(user, 'created', 'blog', blog.id, { title }); return json(res, 201, { blog });
    }
    const blogMatch = pathname.match(/^\/api\/admin\/blogs\/([^/]+)$/);
    if (blogMatch && ['PATCH','DELETE'].includes(method)) {
      if (!canContent) return json(res, 403, { error: 'Content management permission required.' });
      const id = decodeURIComponent(blogMatch[1]); const current = await getRecord('blogs', id); if (!current) return json(res, 404, { error: 'Blog not found.' });
      if (method === 'DELETE') { await deleteRecord('blogs', id); await logActivity(user, 'deleted', 'blog', id, { title: current.title }); return json(res, 200, { ok: true }); }
      const body = await readBody(req); const updated = { ...current, updatedAt: new Date().toISOString() };
      for (const key of ['title','excerpt','content','featuredImage','imageAlt','category','author','publishAt']) if (body[key] !== undefined) updated[key] = key === 'content' ? sanitizeHtml(body[key]) : clean(body[key], key === 'content' ? 500000 : 2000);
      if (body.slug !== undefined) { const slug = safeSlug(body.slug); if ((await listRecords('blogs')).some(b=>b.id!==id && b.slug===slug)) return json(res,409,{error:'This blog URL already exists.'}); updated.slug=slug; }
      if (Array.isArray(body.tags)) updated.tags=body.tags.map(v=>clean(v,60)).slice(0,20);
      if (body.seo && typeof body.seo === 'object') updated.seo=body.seo;
      if (['draft','published','scheduled'].includes(body.status)) { updated.status=body.status; if (body.status==='published' && current.status!=='published') updated.publishAt=new Date().toISOString(); }
      await putRecord('blogs', updated); await logActivity(user, 'updated', 'blog', id, { status: updated.status }); return json(res,200,{blog:updated});
    }
    if (pathname === '/api/admin/categories' && method === 'GET') {
      if (!canContent) return json(res,403,{error:'Content management permission required.'}); return json(res,200,{categories:await listRecords('categories')});
    }
    if (pathname === '/api/admin/categories' && method === 'POST') {
      if (!canContent) return json(res,403,{error:'Content management permission required.'}); const body=await readBody(req); const name=clean(body.name,100); const slug=safeSlug(body.slug||name); if(!name) return json(res,400,{error:'Category name is required.'}); if((await listRecords('categories')).some(c=>c.slug===slug)) return json(res,409,{error:'Category already exists.'}); const category={id:crypto.randomUUID(),name,slug,createdAt:new Date().toISOString()}; await putRecord('categories',category); await logActivity(user,'created','category',category.id); return json(res,201,{category});
    }
    if (pathname === '/api/admin/seo' && method === 'GET') {
      if (!canContent) return json(res,403,{error:'SEO management permission required.'}); return json(res,200,{pages:await listRecords('seo')});
    }
    if (pathname === '/api/admin/seo' && method === 'PUT') {
      if (!canContent) return json(res,403,{error:'SEO management permission required.'}); const body=await readBody(req); const pagePath=clean(body.path,300); if(!pagePath.startsWith('/')) return json(res,400,{error:'Page path must start with /.'});
      const id=`seo:${pagePath}`; const record={id,path:pagePath,fields:{title:clean(body.title,220),description:clean(body.description,500),keywords:clean(body.keywords,500),canonical:clean(body.canonical,500),robots:clean(body.robots,40)||'index,follow',ogTitle:clean(body.ogTitle,220),ogDescription:clean(body.ogDescription,500),ogImage:clean(body.ogImage,800)},updatedAt:new Date().toISOString(),updatedBy:user.email};
      await putRecord('seo',record); await logActivity(user,'updated','seo',pagePath); return json(res,200,{seo:record});
    }
    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!isSuper) return json(res,403,{error:'Super Admin permission required.'}); const users=await listRecords('users'); return json(res,200,{users:users.map(safeUser)});
    }
    if (pathname === '/api/admin/users' && method === 'POST') {
      if (!isSuper) return json(res,403,{error:'Super Admin permission required.'}); const body=await readBody(req); const email=clean(body.email,254).toLowerCase(); const name=clean(body.name,140); const password=String(body.password||''); const role=['super_admin','sales','marketing'].includes(body.role)?body.role:'sales';
      if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<12) return json(res,400,{error:'Enter a name, valid email and password of at least 12 characters.'});
      if(await findUserByEmail(email)) return json(res,409,{error:'A user with this email already exists.'});
      const newUser={id:crypto.randomUUID(),email,name,role,active:true,passwordHash:await hashPassword(password),createdAt:new Date().toISOString()}; await putRecord('users',newUser); await logActivity(user,'created','user',newUser.id,{email,role}); return json(res,201,{user:safeUser(newUser)});
    }
    const userMatch=pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if(userMatch && method==='PATCH') {
      if(!isSuper) return json(res,403,{error:'Super Admin permission required.'}); const id=decodeURIComponent(userMatch[1]); const existing=await getRecord('users',id); if(!existing) return json(res,404,{error:'User not found.'}); const body=await readBody(req); if(id===user.id && body.active===false) return json(res,400,{error:'You cannot disable your own account.'}); const updated={...existing};
      if(body.name!==undefined) updated.name=clean(body.name,140); if(body.active!==undefined) updated.active=Boolean(body.active); if(['super_admin','sales','marketing'].includes(body.role)) updated.role=body.role; if(body.password){if(String(body.password).length<12) return json(res,400,{error:'Password must be at least 12 characters.'}); updated.passwordHash=await hashPassword(body.password);} await putRecord('users',updated); await logActivity(user,'updated','user',id); return json(res,200,{user:safeUser(updated)});
    }
    if (method === 'GET' && pathname === '/api/admin/activity') {
      if (!isSuper) return json(res,403,{error:'Super Admin permission required.'}); return json(res,200,{activity:(await listRecords('activity')).slice(0,100)});
    }
    if (method === 'POST' && pathname === '/api/admin/uploads') {
      if (!canContent) return json(res,403,{error:'Content management permission required.'}); const body=await readBody(req); const match=String(body.dataUrl||'').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/); if(!match) return json(res,400,{error:'Use a JPG, PNG, WEBP or GIF image.'}); const buffer=Buffer.from(match[2],'base64'); if(buffer.length>5*1024*1024) return json(res,413,{error:'Image must be 5 MB or smaller.'}); const id=crypto.randomUUID(); const filename=clean(body.filename,160)||'blog-image';
      if(useDatabase) await pool.query('INSERT INTO admin_media(id,filename,mime_type,data) VALUES($1,$2,$3,$4)',[id,filename,match[1],buffer]); else await putRecord('media',{id,filename,mimeType:match[1],data:buffer.toString('base64'),createdAt:new Date().toISOString()});
      return json(res,201,{url:`/api/uploads/${id}`,id});
    }
    return json(res,404,{error:'Admin API route not found.'});
  }
  return json(res,404,{error:'API route not found.'});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await storageReady;
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Method not allowed'});
    let pathname; try { pathname=decodeURIComponent(url.pathname); } catch { return json(res,400,{error:'Invalid URL'}); }
    if(pathname==='/') pathname='/index.html';
    const filePath=path.resolve(ROOT,'.'+pathname);
    if(!filePath.startsWith(ROOT+path.sep) && filePath!==ROOT) return json(res,403,{error:'Forbidden'});
    fs.stat(filePath,(err,stat)=>{
      if(err||!stat.isFile()) return json(res,404,{error:'Page not found'});
      const ext=path.extname(filePath).toLowerCase(); const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.xml':'application/xml; charset=utf-8'};
      res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'}); if(req.method==='HEAD') return res.end(); fs.createReadStream(filePath).pipe(res);
    });
  } catch(error) {
    console.error('API error:',error);
    if(!res.headersSent) json(res,500,{error:'Internal server error. Please try again.'});
  }
});
const storageReady = initStorage().then(async () => {
  if (!useDatabase && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (String(process.env.ADMIN_PASSWORD).length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    const existing = await findUserByEmail(process.env.ADMIN_EMAIL.toLowerCase());
    if (!existing) {
      const user={id:crypto.randomUUID(),email:process.env.ADMIN_EMAIL.toLowerCase(),name:process.env.ADMIN_NAME||'Clearbot Super Admin',role:'super_admin',active:true,passwordHash:await hashPassword(process.env.ADMIN_PASSWORD),createdAt:new Date().toISOString()};
      await putRecord('users',user); console.log(`Initial local super admin created for ${user.email}`);
    }
  }
}).catch(error => { console.error('Storage initialization failed:',error); throw error; });

server.listen(API_PORT,HOST,()=>console.log(`Clearbot API listening on http://${HOST}:${API_PORT}\nAPI health: http://${HOST}:${API_PORT}/api/health\nEnquiry notifications: ${NOTIFY_TO}; SMTP configured: ${Boolean(transporter)}`));



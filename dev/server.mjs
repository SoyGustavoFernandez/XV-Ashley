// Servidor local para validar todo sin desplegar.
//   npm run dev        -> base de datos EN MEMORIA con invitados de ejemplo (no necesita Supabase)
//   npm run dev:real   -> usa tu Supabase real (variables en .env.local)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const REAL = process.argv.includes('--real');

process.env.LOCAL_DEV = '1';
process.env.SESSION_SECRET ||= 'dev-secret-solo-para-local-123456';
if (!REAL) { process.env.ADMIN_PASSWORD ||= 'admin'; process.env.GATE_PIN ||= '1234'; }

const lib = await import('../api/_lib.js');

if (!REAL) {
  const { fakeDb } = await import('./fake-db.mjs');
  const fake = fakeDb();
  const now = Date.now();
  fake.tables.guests.push(
    seed('FAMROJAS23', 'Familia Rojas Vega', 4, 'confirmed', 3, 'Felicidades Ashley, ahí estaremos.'),
    seed('CARLAMEND2', 'Carla Mendoza', 2, 'pending'),
    seed('LUISCHAVE3', 'Luis Chávez', 1, 'declined'),
    seed('TIOSSAAVE4', 'Tíos Saavedra', 5, 'pending'),
  );
  function seed(code, name, max, status, size = null, message = null) {
    return { id: crypto.randomUUID(), code, name, max_party: max, status, party_size: size, phone: null, message,
      confirmed_at: status === 'pending' ? null : new Date(now).toISOString(), checked_in_at: null, checked_in_by: null,
      created_at: new Date(now).toISOString() };
  }
  lib.__setDb(fake);
} else if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local'); process.exit(1);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
const handlers = new Map();

async function runApi(name, req, res, url) {
  if (!handlers.has(name)) {
    const file = path.join(ROOT, 'api', name + '.js');
    if (name.startsWith('_') || !fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"No existe"}'); }
    handlers.set(name, (await import(pathToFileURL(file).href)).default);
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  let parsed; try { parsed = raw ? JSON.parse(raw) : undefined; } catch { parsed = undefined; }
  const shim = {
    status(c) { res.statusCode = c; return this; },
    setHeader: (k, v) => res.setHeader(k, v),
    json(b) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); },
  };
  try {
    await handlers.get(name)({ method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body: parsed }, shim);
  } catch (e) { console.error(e); res.statusCode = 500; res.end('{"error":"Error del servidor"}'); }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);
  if (p.startsWith('/api/')) return runApi(p.slice(5).replace(/\/$/, ''), req, res, url);

  let file = p === '/puerta' || p === '/puerta/' ? '/puerta/index.html'
           : p === '/panel' || p === '/panel/' ? '/panel/index.html'
           : p.endsWith('/') ? p + 'index.html' : p;
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.statusCode = 404; return res.end('No encontrado'); }
  res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}).listen(PORT, () => {
  const b = `http://localhost:${PORT}`;
  console.log(`\nServidor local listo (${REAL ? 'Supabase REAL' : 'base en MEMORIA con datos de ejemplo'})\n`);
  console.log(`  Invitación (con link): ${b}/?i=FAMROJAS23   (Familia Rojas Vega, ya confirmada)`);
  console.log(`  Otros links de prueba: ${b}/?i=CARLAMEND2   ${b}/?i=TIOSSAAVE4`);
  console.log(`  Sin link:              ${b}/`);
  console.log(`  Vigilante:             ${b}/puerta   PIN: ${REAL ? '(GATE_PIN)' : '1234'}`);
  console.log(`  Panel:                 ${b}/panel    contraseña: ${REAL ? '(ADMIN_PASSWORD)' : 'admin'}\n`);
  if (!REAL) console.log('  Los datos se pierden al detener el servidor.\n');
});

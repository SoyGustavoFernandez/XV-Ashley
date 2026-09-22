import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/* ---------- Supabase (solo servidor, con service_role) ---------- */
// Este proyecto no usa Supabase Realtime (canales en vivo), pero el cliente
// intenta inicializarlo de todos modos al crearse. En el runtime de Vercel
// (Node 20) no existe WebSocket global, así que sin esto el simple hecho de
// crear el cliente tumba la función con 500. Le damos un "transporte" de
// relleno que nunca se llega a usar (no abrimos canales realtime).
class NoRealtimeTransport {
  constructor() {
    throw new Error('Realtime (WebSocket) no está habilitado en este proyecto.');
  }
}

let _db;
/** Solo para pruebas: inyecta un cliente falso. */
export function __setDb(fake) { _db = fake; }
export function db() {
  if (!_db) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan variables de Supabase');
    _db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: NoRealtimeTransport },
    });
  }
  return _db;
}

/* ---------- Respuestas ---------- */
export const send = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
};

export function body(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  try { return JSON.parse(b || '{}'); } catch { return {}; }
}

/* ---------- Códigos de invitado ---------- */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I
export const CODE_RE = /^[A-Z2-9]{10}$/;

export function newCode() {
  let s = '';
  for (let i = 0; i < 10; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

export function cleanCode(v) {
  const s = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tail = s.slice(-10); // acepta un QR con URL o prefijo
  return CODE_RE.test(tail) ? tail : null;
}

/* ---------- Sesiones firmadas (cookie HMAC) ---------- */
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET ausente o muy corto');
  return s;
}

export function signSession(role, ttlSec) {
  const payload = b64u(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const mac = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const good = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return data;
  } catch { return null; }
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

// En desarrollo local (http) la cookie no puede llevar Secure en todos los navegadores.
const SECURE = process.env.LOCAL_DEV ? '' : ' Secure;';

export function setSessionCookie(res, token, ttlSec) {
  res.setHeader('Set-Cookie',
    `sess=${encodeURIComponent(token)}; HttpOnly;${SECURE} SameSite=Strict; Path=/; Max-Age=${ttlSec}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `sess=; HttpOnly;${SECURE} SameSite=Strict; Path=/; Max-Age=0`);
}

/** Exige una sesión con alguno de los roles. Devuelve la sesión o responde 401/403. */
export function requireRole(req, res, roles) {
  const s = verifySession(readCookie(req, 'sess'));
  if (!s) { send(res, 401, { error: 'No autorizado' }); return null; }
  if (!roles.includes(s.role)) { send(res, 403, { error: 'Sin permiso' }); return null; }
  return s;
}

/** Comparación de secretos en tiempo constante. */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ---------- Validaciones ---------- */
export const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** Datos que el invitado puede ver de su propia fila. */
export function publicGuest(g) {
  return {
    code: g.code,
    name: g.name,
    maxParty: g.max_party,
    status: g.status,
    partySize: g.party_size,
    checkedIn: !!g.checked_in_at,
  };
}

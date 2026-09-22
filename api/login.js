import { body, send, safeEqual, signSession, setSessionCookie, clearSessionCookie, clip } from './_lib.js';

const TTL = { admin: 12 * 3600, gate: 24 * 3600 };

export default async function handler(req, res) {
  if (req.method === 'DELETE') { clearSessionCookie(res); return send(res, 200, { ok: true }); }
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });

  const { role, secret } = body(req);
  const expected = role === 'admin' ? process.env.ADMIN_PASSWORD
                 : role === 'gate'  ? process.env.GATE_PIN
                 : null;

  if (!expected || !safeEqual(clip(secret, 100), expected)) {
    await new Promise((r) => setTimeout(r, 600)); // frena fuerza bruta básica
    return send(res, 401, { error: 'Credencial incorrecta' });
  }
  setSessionCookie(res, signSession(role, TTL[role]), TTL[role]);
  return send(res, 200, { ok: true, role });
}

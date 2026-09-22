import { db, send, body, cleanCode, requireRole, clip } from './_lib.js';

const ROLES = ['gate', 'admin'];

export default async function handler(req, res) {
  const s = requireRole(req, res, ROLES);
  if (!s) return;
  const sb = db();

  /* GET: contadores y búsqueda manual por nombre */
  if (req.method === 'GET') {
    const q = clip(req.query.q, 60).replace(/[%_,()]/g, ' ');
    const { data: all, error } = await sb.from('guests')
      .select('party_size,checked_in_at').eq('status', 'confirmed');
    if (error) return send(res, 500, { error: 'Error del servidor' });

    const counters = {
      expected: all.reduce((n, g) => n + g.party_size, 0),
      inside: all.filter((g) => g.checked_in_at).reduce((n, g) => n + g.party_size, 0),
    };
    let results = [];
    if (q.length >= 2) {
      const r = await sb.from('guests')
        .select('code,name,party_size,checked_in_at')
        .eq('status', 'confirmed').ilike('name', `%${q}%`).order('name').limit(20);
      if (r.error) return send(res, 500, { error: 'Error del servidor' });
      results = r.data.map((g) => ({
        code: g.code, name: g.name, partySize: g.party_size, checkedInAt: g.checked_in_at,
      }));
    }
    return send(res, 200, { counters, results });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });

  /* POST: registrar ingreso. Una sola sentencia atómica: si dos personas
     escanean el mismo QR a la vez, solo una actualiza la fila. */
  const code = cleanCode(body(req).code);
  if (!code) return send(res, 200, { result: 'invalid' });

  const now = new Date().toISOString();
  const { data, error } = await sb.from('guests')
    .update({ checked_in_at: now, checked_in_by: s.role })
    .eq('code', code).eq('status', 'confirmed').is('checked_in_at', null)
    .select('name,party_size').maybeSingle();
  if (error) return send(res, 500, { error: 'Error del servidor' });

  if (data) return send(res, 200, { result: 'ok', name: data.name, partySize: data.party_size, at: now });

  // No se actualizó ninguna fila: averiguar por qué
  const { data: g } = await sb.from('guests')
    .select('name,party_size,status,checked_in_at').eq('code', code).maybeSingle();
  if (!g) return send(res, 200, { result: 'invalid' });
  if (g.checked_in_at) return send(res, 200, { result: 'used', name: g.name, partySize: g.party_size, at: g.checked_in_at });
  return send(res, 200, { result: 'not_confirmed', name: g.name, status: g.status });
}

import { db, send, body, newCode, requireRole, clip } from './_lib.js';

const COLS = 'id,code,name,max_party,status,party_size,phone,message,confirmed_at,checked_in_at,created_at';

export default async function handler(req, res) {
  if (!requireRole(req, res, ['admin'])) return;
  const sb = db();

  /* GET: lista completa + estadísticas (el panel la consulta cada pocos segundos) */
  if (req.method === 'GET') {
    const { data, error } = await sb.from('guests').select(COLS).order('created_at', { ascending: true });
    if (error) return send(res, 500, { error: 'Error del servidor' });

    const confirmed = data.filter((g) => g.status === 'confirmed');
    const inside = confirmed.filter((g) => g.checked_in_at);
    const sum = (arr, f) => arr.reduce((n, g) => n + f(g), 0);
    const stats = {
      invitedFamilies: data.length,
      invitedSeats: sum(data, (g) => g.max_party),
      confirmedFamilies: confirmed.length,
      confirmedPeople: sum(confirmed, (g) => g.party_size),
      declinedFamilies: data.filter((g) => g.status === 'declined').length,
      pendingFamilies: data.filter((g) => g.status === 'pending').length,
      insideFamilies: inside.length,
      insidePeople: sum(inside, (g) => g.party_size),
    };
    return send(res, 200, { stats, guests: data });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const b = body(req);

  /* Alta de invitados (uno o varios) */
  if (b.action === 'add') {
    const list = Array.isArray(b.guests) ? b.guests.slice(0, 300) : [];
    const rows = list
      .map((g) => ({
        name: clip(g.name, 80),
        max_party: Math.min(20, Math.max(1, Number.parseInt(g.maxParty, 10) || 1)),
        code: newCode(),
      }))
      .filter((g) => g.name);
    if (!rows.length) return send(res, 400, { error: 'No hay invitados válidos' });
    const { data, error } = await sb.from('guests').insert(rows).select(COLS);
    if (error) return send(res, 500, { error: 'No se pudo guardar (¿código repetido? intenta de nuevo)' });
    return send(res, 200, { added: data });
  }

  if (!b.id) return send(res, 400, { error: 'Falta id' });

  if (b.action === 'update') {
    const patch = {};
    if (b.name !== undefined) patch.name = clip(b.name, 80);
    if (b.maxParty !== undefined) patch.max_party = Math.min(20, Math.max(1, Number.parseInt(b.maxParty, 10) || 1));
    if (patch.name === '') return send(res, 400, { error: 'Nombre vacío' });
    const { error } = await sb.from('guests').update(patch).eq('id', b.id);
    if (error) return send(res, 400, { error: 'No se pudo actualizar (¿cupo menor a lo ya confirmado?)' });
    return send(res, 200, { ok: true });
  }

  if (b.action === 'delete') {
    const { error } = await sb.from('guests').delete().eq('id', b.id);
    if (error) return send(res, 500, { error: 'No se pudo eliminar' });
    return send(res, 200, { ok: true });
  }

  // Deshacer un ingreso registrado por error
  if (b.action === 'reset_checkin') {
    const { error } = await sb.from('guests').update({ checked_in_at: null, checked_in_by: null }).eq('id', b.id);
    if (error) return send(res, 500, { error: 'No se pudo deshacer' });
    return send(res, 200, { ok: true });
  }

  return send(res, 400, { error: 'Acción desconocida' });
}

import { db, send, body, cleanCode, clip, publicGuest } from './_lib.js';

// Público: el invitado confirma o declina con su código personal.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });

  const b = body(req);
  const code = cleanCode(b.i);
  if (!code) return send(res, 400, { error: 'Enlace inválido' });
  if (typeof b.attending !== 'boolean') return send(res, 400, { error: 'Falta indicar si asistirás' });

  const sb = db();
  const { data: g, error: e1 } = await sb.from('guests')
    .select('code,name,max_party,status,party_size,checked_in_at')
    .eq('code', code).maybeSingle();
  if (e1) return send(res, 500, { error: 'Error del servidor' });
  if (!g) return send(res, 404, { error: 'Invitación no encontrada' });
  if (g.checked_in_at) return send(res, 409, { error: 'Esta invitación ya fue usada en la puerta' });

  let partySize = null;
  if (b.attending) {
    partySize = Number.parseInt(b.partySize, 10);
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > g.max_party) {
      return send(res, 400, { error: `Puedes confirmar entre 1 y ${g.max_party} personas` });
    }
  }

  const update = {
    status: b.attending ? 'confirmed' : 'declined',
    party_size: partySize,
    phone: clip(b.phone, 30) || null,
    message: clip(b.message, 300) || null,
    confirmed_at: new Date().toISOString(),
  };

  const { data, error: e2 } = await sb.from('guests').update(update)
    .eq('code', code).is('checked_in_at', null)
    .select('code,name,max_party,status,party_size,checked_in_at').maybeSingle();
  if (e2) return send(res, 500, { error: 'No se pudo guardar tu respuesta' });
  if (!data) return send(res, 409, { error: 'Esta invitación ya fue usada en la puerta' });

  return send(res, 200, publicGuest(data));
}

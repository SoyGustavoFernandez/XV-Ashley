import { db, send, cleanCode, publicGuest } from './_lib.js';

// Público: datos mínimos de un invitado a partir de su código personal.
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
  const code = cleanCode(req.query.i);
  if (!code) return send(res, 400, { error: 'Enlace inválido' });

  const { data, error } = await db().from('guests')
    .select('code,name,max_party,status,party_size,checked_in_at')
    .eq('code', code).maybeSingle();

  if (error) return send(res, 500, { error: 'Error del servidor' });
  if (!data) return send(res, 404, { error: 'Invitación no encontrada' });
  return send(res, 200, publicGuest(data));
}

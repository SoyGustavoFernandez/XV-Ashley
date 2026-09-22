import { db, send } from './_lib.js';

// Cron diario de Vercel: genera actividad para que Supabase (plan gratis) no pause el proyecto.
// Si defines CRON_SECRET en Vercel, este endpoint solo responde al cron.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return send(res, 401, { error: 'No autorizado' });
  }
  const { count, error } = await db().from('guests').select('id', { count: 'exact', head: true });
  if (error) return send(res, 500, { error: 'Error del servidor' });
  return send(res, 200, { ok: true, guests: count });
}

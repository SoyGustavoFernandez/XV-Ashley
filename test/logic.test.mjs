// Pruebas de lógica del servidor con una base de datos falsa en memoria.
// Ejecutar: npm install && npm test
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'secreto-de-prueba-1234567890';
process.env.ADMIN_PASSWORD = 'clave-admin';
process.env.GATE_PIN = '4321';

const lib = await import('../api/_lib.js');
const { default: login } = await import('../api/login.js');
const { default: guestH } = await import('../api/guest.js');
const { default: rsvp } = await import('../api/rsvp.js');
const { default: checkin } = await import('../api/checkin.js');
const { default: admin } = await import('../api/admin.js');

import { fakeDb } from '../dev/fake-db.mjs';

/* ---------- Helpers de request/response ---------- */
function call(handler, { method = 'GET', query = {}, body, cookie } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      status(c) { this.code = c; return this; },
      setHeader(k, v) { headers[k] = v; },
      json(b) { resolve({ status: this.code, body: b, headers }); },
    };
    handler({ method, query, body, headers: cookie ? { cookie } : {} }, res);
  });
}
const cookieOf = (r) => r.headers['Set-Cookie'].split(';')[0];

const fake = fakeDb();
lib.__setDb(fake);

/* ---------- Sesiones ---------- */
{
  const t = lib.signSession('gate', 60);
  assert.equal(lib.verifySession(t).role, 'gate');
  assert.equal(lib.verifySession(t + 'x'), null, 'firma alterada debe fallar');
  assert.equal(lib.verifySession(lib.signSession('gate', -5)), null, 'expirada debe fallar');
  const forged = Buffer.from(JSON.stringify({ role: 'admin', exp: 9e9 })).toString('base64url') + '.' + t.split('.')[1];
  assert.equal(lib.verifySession(forged), null, 'no se puede subir de rol');
}

/* ---------- Códigos ---------- */
{
  const c = lib.newCode();
  assert.match(c, /^[A-Z2-9]{10}$/);
  assert.equal(lib.cleanCode('https://x.com/?i=' + c), c, 'acepta URL con el código al final');
  assert.equal(lib.cleanCode('abc'), null);
}

/* ---------- Login ---------- */
{
  assert.equal((await call(login, { method: 'POST', body: { role: 'admin', secret: 'mala' } })).status, 401);
  assert.equal((await call(login, { method: 'POST', body: { role: 'gate', secret: 'clave-admin' } })).status, 401, 'la clave de admin no sirve como PIN');
}
const adminCk = cookieOf(await call(login, { method: 'POST', body: { role: 'admin', secret: 'clave-admin' } }));
const gateCk = cookieOf(await call(login, { method: 'POST', body: { role: 'gate', secret: '4321' } }));

/* ---------- Admin: permisos y alta ---------- */
assert.equal((await call(admin)).status, 401, 'sin sesión');
assert.equal((await call(admin, { cookie: gateCk })).status, 403, 'el vigilante no ve el panel');
const add = await call(admin, { method: 'POST', cookie: adminCk, body: { action: 'add', guests: [
  { name: 'Familia Rojas', maxParty: 4 }, { name: 'Carla Mendoza', maxParty: 2 }, { name: 'Luis Chávez', maxParty: 1 }, { name: '  ', maxParty: 3 } ] } });
assert.equal(add.body.added.length, 3, 'ignora nombres vacíos');
const [rojas, carla, luis] = add.body.added;

/* ---------- Invitado: ver y confirmar ---------- */
assert.equal((await call(guestH, { query: { i: 'ZZZZZZZZZZ' } })).status, 404);
assert.equal((await call(guestH, { query: { i: rojas.code } })).body.name, 'Familia Rojas');
assert.equal((await call(guestH, { query: { i: rojas.code } })).body.phone, undefined, 'no expone datos privados');

assert.equal((await call(rsvp, { method: 'POST', body: { i: rojas.code, attending: true, partySize: 5 } })).status, 400, 'no puede pasarse del cupo');
assert.equal((await call(rsvp, { method: 'POST', body: { i: rojas.code, attending: true, partySize: 0 } })).status, 400);
const ok = await call(rsvp, { method: 'POST', body: { i: rojas.code, attending: true, partySize: 3, phone: '999', message: 'Hola' } });
assert.equal(ok.body.status, 'confirmed'); assert.equal(ok.body.partySize, 3);
const dec = await call(rsvp, { method: 'POST', body: { i: luis.code, attending: false } });
assert.equal(dec.body.status, 'declined'); assert.equal(dec.body.partySize, null);
await call(rsvp, { method: 'POST', body: { i: carla.code, attending: true, partySize: 2 } });

/* ---------- Puerta: check-in atómico y anti-reuso ---------- */
assert.equal((await call(checkin, { method: 'POST', body: { code: rojas.code } })).status, 401, 'sin sesión no se escanea');
const scan = (code) => call(checkin, { method: 'POST', cookie: gateCk, body: { code } });

const s1 = (await scan(rojas.code)).body;
assert.equal(s1.result, 'ok'); assert.equal(s1.partySize, 3); assert.equal(s1.name, 'Familia Rojas');
const s2 = (await scan(rojas.code)).body;
assert.equal(s2.result, 'used', 'segundo escaneo debe rechazarse'); assert.ok(s2.at);
assert.equal((await scan(luis.code)).body.result, 'not_confirmed', 'declinado no entra');
assert.equal((await scan('ZZZZZZZZZZ')).body.result, 'invalid');
assert.equal((await scan('basura')).body.result, 'invalid');

// Dos escaneos simultáneos del mismo QR: solo uno pasa
const [a, b] = await Promise.all([scan(carla.code), scan(carla.code)]);
assert.deepEqual([a.body.result, b.body.result].sort(), ['ok', 'used']);

/* ---------- No se puede cambiar respuesta tras ingresar ---------- */
assert.equal((await call(rsvp, { method: 'POST', body: { i: rojas.code, attending: false } })).status, 409);

/* ---------- Contadores y búsqueda manual ---------- */
const info = (await call(checkin, { cookie: gateCk, query: { q: 'carl' } })).body;
assert.equal(info.counters.expected, 5); assert.equal(info.counters.inside, 5);
assert.equal(info.results.length, 1); assert.equal(info.results[0].name, 'Carla Mendoza');

/* ---------- Estadísticas del panel ---------- */
{
  const s = (await call(admin, { cookie: adminCk })).body.stats;
  assert.equal(s.invitedFamilies, 3); assert.equal(s.confirmedFamilies, 2); assert.equal(s.confirmedPeople, 5);
  assert.equal(s.insidePeople, 5); assert.equal(s.declinedFamilies, 1); assert.equal(s.pendingFamilies, 0);
}

/* ---------- Deshacer ingreso y borrar ---------- */
await call(admin, { method: 'POST', cookie: adminCk, body: { action: 'reset_checkin', id: carla.id } });
assert.equal((await scan(carla.code)).body.result, 'ok', 'tras deshacer vuelve a ser válido');
await call(admin, { method: 'POST', cookie: adminCk, body: { action: 'delete', id: luis.id } });
assert.equal((await call(guestH, { query: { i: luis.code } })).status, 404);

console.log('✔ Todas las pruebas de lógica pasaron');

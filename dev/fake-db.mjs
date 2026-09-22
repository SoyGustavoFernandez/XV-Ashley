// Base de datos falsa en memoria que imita el encadenado de supabase-js.
// Sirve para pruebas (npm test) y para el modo local sin Supabase (npm run dev).
export function fakeDb() {
  const tables = { guests: [] };
  const from = (name) => {
    const st = { op: 'select', patch: null, rows: null, filters: [], cols: null, ord: null, lim: null, single: false };
    const match = (r) => st.filters.every((f) => f(r));
    const pick = (r) => (st.cols && st.cols !== '*' && !st.cols.includes('id,code') ? Object.fromEntries(st.cols.split(',').map((c) => [c.trim(), r[c.trim()]])) : { ...r });
    const run = () => {
      const t = tables[name];
      if (st.op === 'insert') {
        const added = st.rows.map((r) => ({ id: crypto.randomUUID(), status: 'pending', party_size: null, phone: null, message: null,
          confirmed_at: null, checked_in_at: null, checked_in_by: null, created_at: new Date().toISOString(), ...r }));
        if (added.some((a) => t.some((x) => x.code === a.code))) return { data: null, error: { message: 'dup' } };
        t.push(...added);
        return { data: added.map(pick), error: null };
      }
      if (st.op === 'update') {
        const hit = t.filter(match);
        for (const r of hit) {
          const next = { ...r, ...st.patch };
          if (next.party_size != null && next.party_size > next.max_party) return { data: null, error: { message: 'check' } };
          Object.assign(r, st.patch);
        }
        return { data: hit.map(pick), error: null };
      }
      if (st.op === 'delete') { tables[name] = t.filter((r) => !match(r)); return { data: null, error: null }; }
      let out = t.filter(match).map(pick);
      if (st.ord) out.sort((a, b) => String(a[st.ord] ?? '').localeCompare(String(b[st.ord] ?? '')));
      if (st.lim) out = out.slice(0, st.lim);
      return { data: out, error: null };
    };
    const api = {
      select(c) { st.cols = c; return api; },
      insert(r) { st.op = 'insert'; st.rows = r; return api; },
      update(p) { st.op = 'update'; st.patch = p; return api; },
      delete() { st.op = 'delete'; return api; },
      eq(k, v) { st.filters.push((r) => r[k] === v); return api; },
      is(k, v) { st.filters.push((r) => (v === null ? r[k] == null : r[k] === v)); return api; },
      ilike(k, p) { const s = p.replace(/%/g, '').toLowerCase(); st.filters.push((r) => String(r[k]).toLowerCase().includes(s)); return api; },
      order(k) { st.ord = k; return api; },
      limit(n) { st.lim = n; return api; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return api;
  };
  return { from, tables };
}


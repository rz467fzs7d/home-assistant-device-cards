export function todayVisits(state, now = new Date()) {
  const data = state?.attributes || {};
  const rows = Array.isArray(data.pets) && data.pets.every(p => p && typeof p === 'object') ? data.pets : null;
  const pets = rows ? rows.map(p => ({ id: String(p.id), name: String(p.name || 'Pet'), count: null })) : [];
  const unknown = { pets, total: null, unidentified: null, complete: false };
  if (!state || !rows || ['unknown', 'unavailable'].includes(state.state) || data.complete !== true) return unknown;
  let date;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: data.time_zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = type => parts.find(p => p.type === type)?.value;
    date = `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return unknown; }
  const count = n => Number.isInteger(n) && n >= 0;
  if (!data.time_zone || date !== data.date || !count(data.total) || !count(data.unidentified)
      || data.pets.some(p => !count(p.count)) || new Set(pets.map(p => p.id)).size !== pets.length
      || data.pets.reduce((sum, p) => sum + p.count, data.unidentified) !== data.total
      || Number(state.state) !== data.total) return unknown;
  return { pets: data.pets.map((p, i) => ({ ...pets[i], count: p.count })), total: data.total, unidentified: data.unidentified, complete: true };
}

export function dateInZone(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = key => parts.find(p => p.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftDate(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+value) || value.toISOString().slice(0, 10) !== date) throw new Error('Invalid date');
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function dayBounds(date, zone) {
  const midnight = day => {
    const wall = Date.parse(`${day}T00:00:00Z`);
    let instant = wall;
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    for (let i = 0; i < 3; i++) {
      const parts = formatter.formatToParts(new Date(instant));
      const p = key => Number(parts.find(x => x.type === key).value);
      const displayed = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'), p('second'));
      instant += wall - displayed;
    }
    return new Date(instant).toISOString();
  };
  return [midnight(shiftDate(date, 0)), midnight(shiftDate(date, 1))];
}

export function calendarRecords(events, date, zone) {
  const rows = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    let row;
    try { row = JSON.parse(event.description); } catch { continue; }
    if (!row || row.v !== 1 || typeof row.id !== 'string' || row.id.length > 200
        || !['visit', 'cleaning', 'emptying', 'leveling'].includes(row.kind)
        || !Number.isFinite(row.ts) || row.ts <= 0 || row.ts > 8640000000000) continue;
    try { if (dateInZone(new Date(row.ts * 1000), zone) !== date) continue; } catch { continue; }
    if (rows.has(row.id) && (rows.get(row.id).observed_at || 0) > (row.observed_at || 0)) continue;
    const weight = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
    const corrected = row.kind === 'visit' && row.correction === 'combined_weight';
    rows.set(row.id, { id: row.id, ts: row.ts, kind: row.kind,
      raw_pet_id: typeof row.raw_pet_id === 'string' ? row.raw_pet_id : null,
      pet_id: typeof row.pet_id === 'string' ? row.pet_id : null,
      pet_name: typeof row.pet_name === 'string' ? row.pet_name : 'Unidentified',
      raw_weight_kg: weight(row.raw_weight_kg), weight_kg: corrected ? null : weight(row.weight_kg),
      duration_seconds: Number.isFinite(row.duration_seconds) && row.duration_seconds >= 0 ? row.duration_seconds : null,
      correction: corrected ? 'combined_weight' : null, result: typeof row.result === 'string' ? row.result : null,
      observed_at: Number.isFinite(row.observed_at) ? row.observed_at : 0 });
  }
  return [...rows.values()].sort((a, b) => b.ts - a.ts);
}

export function correctedVisits(source, rows) {
  const visits = rows.filter(row => row.kind === 'visit');
  if (!source.complete || visits.length !== source.total) return { ...source, history_complete: false };
  const count = key => {
    const result = Object.fromEntries(source.pets.map(p => [p.id, 0]));
    result.unidentified = 0;
    for (const row of visits) result[Object.hasOwn(result, row[key]) ? row[key] : 'unidentified']++;
    return result;
  };
  const raw = count('raw_pet_id'), effective = count('pet_id');
  const matches = values => source.pets.every(p => values[p.id] === p.count) && values.unidentified === source.unidentified;
  if (!matches(raw) && !matches(effective)) return { ...source, history_complete: false };
  return { ...source, history_complete: true, corrected: visits.filter(row => row.correction).length,
    unidentified: effective.unidentified, pets: source.pets.map(p => ({ ...p, count: effective[p.id] })) };
}

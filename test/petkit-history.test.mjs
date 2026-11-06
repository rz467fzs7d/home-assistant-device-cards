import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const path = new URL('../src/cards/petkit-history.js', import.meta.url);
async function history() {
  assert.ok(existsSync(path), 'Native calendar timeline adapter is not implemented');
  return import(path);
}
function event(id, ts, extra = {}) {
  return { summary: 'Not used as HTML', description: JSON.stringify({ v: 1, id, ts, kind: 'visit',
    raw_pet_id: '2', pet_id: '2', pet_name: 'Small', raw_weight_kg: 2.7, weight_kg: 2.7,
    observed_at: ts + 1, ...extra }) };
}
const ts = Date.parse('2026-11-06T04:00:00Z') / 1000;

test('calendar rows are date scoped, allowlisted and deduplicated by event identity', async () => {
  const { calendarRecords } = await history();
  const rows = calendarRecords([event('v', ts), event('v', ts, { pet_name: 'Updated', observed_at: ts + 10 }),
    event('old', ts - 86400), { description: '<img src=x>' }, { description: '{}' },
    event('invalid', ts, { kind: 'unrecognized' })], '2026-11-06', 'Asia/Shanghai');
  assert.equal(rows.length, 1); assert.equal(rows[0].pet_name, 'Updated');
  assert.equal(rows[0].id, 'v');
  assert.equal(calendarRecords(null, '2026-11-06', 'Asia/Shanghai').length, 0);
});

test('corrected totals reconcile with source without double-correcting a cloud reassignment', async () => {
  const { calendarRecords, correctedVisits } = await history();
  const rows = calendarRecords([event('v', ts, { pet_id: '1', pet_name: 'Large',
    raw_weight_kg: 7.5, weight_kg: null, correction: 'combined_weight' })], '2026-11-06', 'Asia/Shanghai');
  const source = { complete: true, total: 1, unidentified: 0,
    pets: [{ id: '1', name: 'Large', count: 0 }, { id: '2', name: 'Small', count: 1 }] };
  assert.deepEqual(correctedVisits(source, rows).pets.map(p => p.count), [1, 0]);
  const cloud = { ...source, pets: [{ id: '1', name: 'Large', count: 1 }, { id: '2', name: 'Small', count: 0 }] };
  assert.deepEqual(correctedVisits(cloud, rows).pets.map(p => p.count), [1, 0]);
  assert.deepEqual(correctedVisits(source, []).pets.map(p => p.count), [0, 1]);
  assert.equal(correctedVisits(source, rows).corrected, 1);
});

test('mismatched or incomplete calendars do not change source counts', async () => {
  const { correctedVisits } = await history();
  const source = { complete: true, total: 2, unidentified: 0,
    pets: [{ id: '1', count: 0 }, { id: '2', count: 2 }] };
  assert.deepEqual(correctedVisits(source, [{ kind: 'visit', raw_pet_id: '2', pet_id: '1' }]).pets, source.pets);
  assert.equal(correctedVisits({ ...source, complete: false }, []).complete, false);
});

test('day bounds handle the HA timezone and DST rather than browser local time', async () => {
  const { dayBounds, dateInZone, shiftDate } = await history();
  assert.equal(dateInZone(new Date('2026-11-05T17:00:00Z'), 'Asia/Shanghai'), '2026-11-06');
  assert.deepEqual(dayBounds('2026-11-06', 'Asia/Shanghai'), ['2026-11-05T16:00:00.000Z', '2026-11-06T16:00:00.000Z']);
  const [start, end] = dayBounds('2026-03-08', 'America/New_York');
  assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, 23);
  assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
  assert.throws(() => dayBounds('2026-02-31', 'Asia/Shanghai'));
});

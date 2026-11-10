import test from 'node:test';
import assert from 'node:assert/strict';
import { yearGrid, binCommits, monthTicks, slotX, layoutAtoms, atomRadius, colourFor, esc, WEEK } from '../src/core.js';

test('yearGrid starts in the week of 1 January and ends in the week of today', () => {
  const g = yearGrid(new Date('2026-11-10T15:00:00Z')); // a Tuesday; 1 January 2026 was a Thursday
  assert.equal(g.year, 2026);
  assert.equal(g.dates[0], '2025-12-28'); // the Sunday before 1 January
  assert.equal(g.dates.at(-1), '2026-11-08'); // the Sunday before today
  assert.equal(g.weeks, 46);
  assert.equal(g.dates.length, g.weeks);
  assert.equal(g.through, '2026-11-10');
  assert.equal(new Date(g.start).getUTCDay(), 0);
  assert.equal(new Date(g.dates[1]).getTime() - new Date(g.dates[0]).getTime(), WEEK);
});

test('yearGrid on 1 January is one week, and a year that starts on a Sunday starts that day', () => {
  assert.equal(yearGrid(new Date('2026-01-01T08:00:00Z')).weeks, 1);
  const g = yearGrid(new Date('2023-03-01T00:00:00Z')); // 1 January 2023 was a Sunday
  assert.equal(g.dates[0], '2023-01-01');
});

test('binCommits counts per week and ignores timestamps outside the year', () => {
  const g = yearGrid(new Date('2026-11-10T15:00:00Z'));
  const stamps = ['2026-11-09T10:00:00Z', '2026-11-08T00:00:00Z', '2026-11-02T23:59:59Z', '2020-01-01T00:00:00Z', '2027-01-01T00:00:00Z',
    '2025-12-30T12:00:00Z', '2026-01-02T12:00:00Z'];
  const bins = binCommits(stamps, g.start, g.weeks, g.jan1);
  assert.equal(bins.length, 46);
  assert.equal(bins[45], 2); // 8 and 9 November
  assert.equal(bins[44], 1); // the week before
  assert.equal(bins[0], 1); // 2 January counts, 30 December of the year before does not
  assert.equal(bins.reduce((a, b) => a + b, 0), 4);
});

test('monthTicks has one tick for every month that has begun, and January carries the year', () => {
  const g = yearGrid(new Date('2026-11-10T15:00:00Z'));
  const ticks = monthTicks(g);
  assert.deepEqual(ticks.map((t) => t.label), ['2026', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
  assert.ok(ticks.every((t, k) => k === 0 || t.i > ticks[k - 1].i));
  assert.ok(ticks.at(-1).i < g.weeks);
  assert.equal(monthTicks(yearGrid(new Date('2026-01-15T00:00:00Z'))).length, 1);
});

test('slotX spreads a full year over the axis and keeps the width of 13 weeks early in the year', () => {
  assert.equal(slotX(0, 46, 6, 700), 6);
  assert.equal(slotX(45, 46, 6, 700), 700);
  assert.equal(slotX(12, 13, 6, 700), 700);
  assert.equal(slotX(0, 1, 6, 700), 6); // one week: no division by zero
  assert.equal(slotX(1, 1, 6, 700) > 6, true);
});

test('atoms never overlap and grow with commits and stars', () => {
  const repos = [
    { name: 'a', commits: 200, stars: 5 },
    { name: 'b', commits: 20, stars: 0 },
    { name: 'c', commits: 0, stars: 0 },
    { name: 'd', commits: 50, stars: 2 },
    { name: 'e', commits: 3, stars: 1 },
  ];
  const pos = layoutAtoms(repos, 720, 230);
  assert.equal(pos.length, repos.length);
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      assert.ok(Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y) > pos[i].r + pos[j].r, `${i} and ${j} overlap`);
    }
  }
  assert.ok(atomRadius(repos[0]) > atomRadius(repos[1]));
  assert.ok(atomRadius(repos[1]) > atomRadius(repos[2]));
});

test('the layout is deterministic', () => {
  const repos = [{ name: 'x', commits: 9, stars: 1 }, { name: 'y', commits: 4, stars: 0 }];
  assert.deepEqual(layoutAtoms(repos, 720, 230), layoutAtoms(repos, 720, 230));
});

test('a language always gets the same colour and text is escaped', () => {
  assert.equal(colourFor('Python'), colourFor('Python'));
  assert.match(colourFor('Python'), /^#[0-9a-f]{6}$/);
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});

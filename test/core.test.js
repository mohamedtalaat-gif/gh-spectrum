import test from 'node:test';
import assert from 'node:assert/strict';
import { yearGrid, binCommits, monthTicks, slotX, weekX, spectrumWidth, wheelScroll, keyScroll, weekAt, WEEK_PX, SPEC_PAD, layoutAtoms, atomRadius, colourFor, esc, WEEK } from '../src/core.js';

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

test('the scrolling spectrum gives every week the same width and keeps room at both ends', () => {
  assert.equal(weekX(0), SPEC_PAD);
  assert.equal(weekX(10) - weekX(9), WEEK_PX);
  assert.equal(spectrumWidth(46), weekX(45) + SPEC_PAD);
  assert.equal(spectrumWidth(1), SPEC_PAD * 2);
  assert.equal(spectrumWidth(0), SPEC_PAD * 2); // no weeks, no negative width
});

test('the wheel moves the spectrum sideways until an end, then hands over to the page', () => {
  const at = (scrollLeft, deltaY, extra = {}) => wheelScroll({ scrollLeft, max: 500, deltaX: 0, deltaY, ...extra });
  assert.equal(at(500, -120), 380); // the spectrum opens at the present: a turn back goes to earlier months
  assert.equal(at(100, 120), 220); // and forward again
  assert.equal(at(30, -120), 0); // clamped at the start
  assert.equal(at(0, -120), null); // at the start the page scrolls instead
  assert.equal(at(500, 120), null); // at the end the page scrolls instead
  assert.equal(at(100, 3, { deltaMode: 1 }), 148); // three lines
  assert.equal(wheelScroll({ scrollLeft: 100, max: 500, deltaX: 80, deltaY: 10 }), null); // a sideways swipe scrolls by itself
  assert.equal(wheelScroll({ scrollLeft: 0, max: 0, deltaX: 0, deltaY: 120 }), null); // nothing to scroll: the whole year fits
});

test('the keys move the focused spectrum and stay inside it', () => {
  const k = (key, scrollLeft) => keyScroll(key, { scrollLeft, max: 600, page: 500 });
  assert.equal(k('ArrowLeft', 300), 300 - WEEK_PX * 4);
  assert.equal(k('ArrowRight', 300), 300 + WEEK_PX * 4);
  assert.equal(k('ArrowRight', 590), 600);
  assert.equal(k('ArrowLeft', 10), 0);
  assert.equal(k('PageDown', 0), 400);
  assert.equal(k('Home', 300), 0);
  assert.equal(k('End', 300), 600);
  assert.equal(k('a', 300), null); // other keys are left alone
});

test('the week under the pointer follows its position and the scroll position', () => {
  const at = (x, scrollLeft = 200) => weekAt({ x, left: 100, scrollLeft, n: 46 });
  const x5 = 100 + weekX(5) - 200; // where week 5 is drawn while the spectrum is scrolled by 200
  assert.equal(at(x5), 5);
  assert.equal(at(x5 + WEEK_PX / 2 - 1), 5); // anywhere in the column of the week
  assert.equal(at(x5 + WEEK_PX / 2 + 1), 6);
  assert.equal(at(x5, 200 + WEEK_PX), 6); // the wheel moved the spectrum under a pointer that did not move
  assert.equal(at(100 + weekX(0) - 400, 400), 0);
  assert.equal(at(100 - 300, 0), null); // left of the first week
  assert.equal(weekAt({ x: 100 + weekX(46), left: 100, scrollLeft: 0, n: 46 }), null); // after the last week
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

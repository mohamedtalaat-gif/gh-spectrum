import test from 'node:test';
import assert from 'node:assert/strict';
import { weekGrid, binCommits, layoutAtoms, atomRadius, colourFor, esc, WEEK } from '../src/core.js';

test('weekGrid ends with the Sunday of the current week and has 52 weekly steps', () => {
  const { start, dates } = weekGrid(new Date('2026-11-10T15:00:00Z')); // a Tuesday
  assert.equal(dates.length, 52);
  assert.equal(dates.at(-1), '2026-11-08'); // the Sunday before
  assert.equal(new Date(start).getUTCDay(), 0);
  assert.equal(new Date(dates[1]).getTime() - new Date(dates[0]).getTime(), WEEK);
});

test('binCommits counts per week and ignores timestamps outside the grid', () => {
  const { start } = weekGrid(new Date('2026-11-10T15:00:00Z'));
  const stamps = ['2026-11-09T10:00:00Z', '2026-11-08T00:00:00Z', '2026-11-02T23:59:59Z', '2020-01-01T00:00:00Z', '2027-01-01T00:00:00Z'];
  const bins = binCommits(stamps, start);
  assert.equal(bins.length, 52);
  assert.equal(bins[51], 2); // 8 and 9 November
  assert.equal(bins[50], 1); // the week before
  assert.equal(bins.reduce((a, b) => a + b, 0), 3);
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

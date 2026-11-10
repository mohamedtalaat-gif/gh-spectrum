import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivity } from '../src/data.js';
import { renderCardSvg, THEMES } from '../src/render-svg.js';
import { weekGrid } from '../src/core.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const { dates } = weekGrid(NOW);

const fixture = () => ({
  user: 'someone',
  dates,
  weeks: dates.map((_, i) => (i % 5 === 0 ? i + 1 : 0)),
  repos: [
    { name: 'alpha', url: 'u', description: '', language: 'Python', stars: 3, pushed: '2026-11-01T00:00:00Z', commits: 120 },
    { name: 'beta-<tool>', url: 'u', description: '', language: 'Python', stars: 0, pushed: '2026-10-01T00:00:00Z', commits: 12 },
    { name: 'gamma', url: 'u', description: '', language: 'HTML', stars: 1, pushed: '2026-09-01T00:00:00Z', commits: 0 },
  ],
});

test('the card is a finished SVG with the numbers of the data', () => {
  const svg = renderCardSvg(fixture(), { theme: 'dark', updated: '2026-11-10' });
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>\s*$/);
  assert.doesNotMatch(svg, /NaN|undefined/);
  const d = fixture();
  const peaks = d.weeks.filter((v) => v > 0).length;
  assert.equal((svg.match(/stroke-linecap="round"/g) ?? []).length, peaks);
  assert.match(svg, new RegExp(`base peak: ${Math.max(...d.weeks)}`));
  for (const name of ['alpha', 'gamma']) assert.ok(svg.includes(name));
  assert.match(svg, /3 repositories/);
  assert.match(svg, /2026-11-10/);
});

test('repository names are escaped', () => {
  const svg = renderCardSvg(fixture());
  assert.doesNotMatch(svg, /beta-<tool>/);
  assert.match(svg, /beta-&lt;tool&gt;/);
});

test('the two themes differ in colour and nothing else breaks', () => {
  const dark = renderCardSvg(fixture(), { theme: 'dark' });
  const light = renderCardSvg(fixture(), { theme: 'light' });
  assert.ok(dark.includes(THEMES.dark.bg));
  assert.ok(light.includes(THEMES.light.bg));
  assert.ok(!dark.includes(THEMES.light.bg));
  assert.equal(dark.length > 2000, true);
});

test('the headline figures can be chosen', () => {
  const only = renderCardSvg(fixture(), { show: ['repos'] });
  assert.match(only, /3 repositories/);
  assert.doesNotMatch(only, /commits in 52 weeks/);
  assert.doesNotMatch(only, /\d+ stars/);
  const all = renderCardSvg(fixture());
  assert.match(all, /commits in 52 weeks/);
  assert.match(all, /4 stars/);
});

test('an empty year still draws', () => {
  const d = fixture();
  d.weeks = d.weeks.map(() => 0);
  d.repos.forEach((r) => (r.commits = 0));
  assert.doesNotMatch(renderCardSvg(d), /NaN|undefined/);
});

// ---- fetchActivity against a fake API --------------------------------------------------------------------------

function fakeApi() {
  const calls = [];
  const sunday = new Date(dates.at(-1)).getTime();
  const stamp = (offsetDays) => new Date(sunday + offsetDays * 864e5 + 3600e3).toISOString();
  const commit = (t) => ({ commit: { author: { date: t } } });
  const fn = async (url, opts) => {
    calls.push({ url, auth: opts?.headers?.Authorization ?? null });
    const u = new URL(url);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.pathname === '/users/someone/repos') {
      return ok([
        { name: 'alpha', fork: false, html_url: 'https://x/alpha', description: 'a', language: 'Python', stargazers_count: 2, pushed_at: '2026-11-09T00:00:00Z' },
        { name: 'forked', fork: true, html_url: 'x', description: '', language: 'C', stargazers_count: 9, pushed_at: '2026-11-09T00:00:00Z' },
        { name: 'someone', fork: false, html_url: 'x', description: 'profile', language: null, stargazers_count: 0, pushed_at: '2026-11-09T00:00:00Z' },
        { name: 'beta', fork: false, html_url: 'https://x/beta', description: '', language: null, stargazers_count: 0, pushed_at: '2026-10-09T00:00:00Z' },
      ]);
    }
    if (u.pathname === '/repos/someone/alpha/commits') {
      const page = Number(u.searchParams.get('page'));
      if (page === 1) return ok(Array.from({ length: 100 }, () => commit(stamp(1))));
      if (page === 2) return ok([commit(stamp(-6)), commit(stamp(-5))]);
      return ok([]);
    }
    if (u.pathname === '/repos/someone/beta/commits') return { ok: false, status: 409, json: async () => ({}) }; // an empty repository
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fn, calls };
}

test('fetchActivity skips forks and the profile repository, reads every page and bins by week', async () => {
  const { fn, calls } = fakeApi();
  const d = await fetchActivity({ user: 'someone', fetchFn: fn, now: NOW, token: 'T' });
  assert.deepEqual(d.repos.map((r) => r.name), ['alpha', 'beta']);
  assert.equal(d.repos[0].commits, 102);
  assert.equal(d.repos[1].commits, 0);
  assert.equal(d.repos[1].language, 'Other');
  assert.equal(d.weeks.length, 52);
  assert.equal(d.weeks[51], 100); // the 100 commits of the current week
  assert.equal(d.weeks[50], 2); // two a week earlier
  assert.equal(d.weeks.reduce((a, b) => a + b, 0), 102);
  assert.ok(calls.every((c) => c.auth === 'Bearer T'));
  assert.ok(calls.some((c) => c.url.includes('page=2')));
});

test('fetchActivity can be limited to named repositories and reports API errors', async () => {
  const { fn } = fakeApi();
  const d = await fetchActivity({ user: 'someone', include: ['beta'], fetchFn: fn, now: NOW });
  assert.deepEqual(d.repos.map((r) => r.name), ['beta']);
  await assert.rejects(fetchActivity({ user: 'nobody', fetchFn: fn, now: NOW }), /404/);
});

test('every atom lies inside the atom area, even with many repositories', () => {
  const d = fixture();
  d.repos = Array.from({ length: 14 }, (_, i) => ({ name: `repo-${i}`, url: 'u', description: '', language: ['Python', 'HTML', 'JavaScript'][i % 3], stars: i % 4, pushed: '2026-11-01T00:00:00Z', commits: i * 9 }));
  const svg = renderCardSvg(d);
  const atoms = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="#[0-9a-f]+" fill-opacity="0.22"/g)].map((m) => m.slice(1).map(Number));
  assert.equal(atoms.length, 14);
  for (const [x, y, r] of atoms) assert.ok(x - r >= 0 && x + r <= 704 && y - r >= 0 && y + r <= 280, `atom at ${x},${y} r=${r} leaves the area`);
});

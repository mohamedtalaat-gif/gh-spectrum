// Fetches the activity of one GitHub user from the public REST API. Works in browsers and in Node 18 or newer.
import { yearGrid, binCommits } from './core.js';

const API = 'https://api.github.com';

/**
 * Returns { user, year, through, weeks, dates, repos }: commits per week from the first week of the current year up to
 * today (summed across the repositories) and one record per public, non-fork repository. The list of repositories is read
 * from the account every time, so it grows and shrinks with the account. `include` (optional) limits it to named
 * repositories. `token` (optional) raises the rate limit; `fetchFn` and `now` exist for tests.
 */
export async function fetchActivity({ user, include = null, token = null, fetchFn = globalThis.fetch, now = new Date() }) {
  const headers = { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const getJson = async (url) => {
    const r = await fetchFn(url, { headers });
    if (!r.ok) throw new Error(`${r.status} ${new URL(url).pathname}`);
    return r.json();
  };

  // Every page of the account's public repositories, a hundred at a time.
  const listed = [];
  for (let page = 1; page <= 10; page++) {
    const chunk = await getJson(`${API}/users/${user}/repos?per_page=100&sort=pushed&page=${page}`);
    listed.push(...chunk);
    if (chunk.length < 100) break;
  }
  const repos = listed.filter((r) => !r.fork && r.name !== user && (!include || include.includes(r.name)));

  const grid = yearGrid(now);
  const since = new Date(grid.jan1).toISOString();
  const weeks = new Array(grid.weeks).fill(0);

  // Commit dates of one repository since 1 January, read a hundred at a time, at most five pages.
  const commitDates = async (name) => {
    const out = [];
    for (let page = 1; page <= 5; page++) {
      let chunk;
      try { chunk = await getJson(`${API}/repos/${user}/${name}/commits?since=${since}&per_page=100&page=${page}`); } catch { break; }
      out.push(...chunk.map((c) => c.commit.author.date));
      if (chunk.length < 100) break;
    }
    return out;
  };

  const detail = await Promise.all(
    repos.map(async (r) => {
      const bins = binCommits(await commitDates(r.name), grid.start, grid.weeks, grid.jan1);
      bins.forEach((n, i) => (weeks[i] += n));
      return {
        name: r.name,
        url: r.html_url,
        description: r.description || '',
        language: r.language || 'Other',
        stars: r.stargazers_count,
        pushed: r.pushed_at,
        commits: bins.reduce((a, b) => a + b, 0),
      };
    })
  );
  return {
    user,
    year: grid.year,
    through: grid.through,
    weeks,
    dates: grid.dates,
    repos: detail.sort((a, b) => b.commits - a.commits || b.stars - a.stars),
  };
}

// Fetches the activity of one GitHub user from the public REST API. Works in browsers and in Node 18 or newer.
import { weekGrid, binCommits } from './core.js';

const API = 'https://api.github.com';

/**
 * Returns { user, weeks, dates, repos }: commits per week over 52 weeks (summed across the repositories) and one record
 * per public, non-fork repository. `token` (optional) raises the rate limit; `fetchFn` and `now` exist for tests.
 */
export async function fetchActivity({ user, include = null, token = null, fetchFn = globalThis.fetch, now = new Date() }) {
  const headers = { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const getJson = async (url) => {
    const r = await fetchFn(url, { headers });
    if (!r.ok) throw new Error(`${r.status} ${new URL(url).pathname}`);
    return r.json();
  };

  const repos = (await getJson(`${API}/users/${user}/repos?per_page=100&sort=pushed`)).filter(
    (r) => !r.fork && r.name !== user && (!include || include.includes(r.name))
  );
  const { start, dates } = weekGrid(now);
  const since = new Date(start).toISOString();
  const weeks = new Array(52).fill(0);

  // Commit dates of one repository over the last year, read a hundred at a time, at most five pages.
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
      const bins = binCommits(await commitDates(r.name), start);
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
  return { user, weeks, dates, repos: detail.sort((a, b) => b.commits - a.commits || b.stars - a.stars) };
}

// Pure helpers of gh-spectrum: time grid, binning, colours and layout. No DOM and no network, so they can be tested in Node.
export const DAY = 864e5;
export const WEEK = 7 * DAY;
export const PALETTE = ['#5b8dff', '#f08a4b', '#58c4a8', '#d6a96e', '#c07df0', '#ef6a70', '#8fb3d9', '#e0c94f'];

export const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const colourFor = (language) => PALETTE[hash(language) % PALETTE.length];
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The 52 weekly bins that end with the week containing `now`. Weeks start on Sunday (UTC). */
export function weekGrid(now = new Date(), weeks = 52) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - end.getUTCDay());
  const start = end.getTime() - (weeks - 1) * WEEK;
  const dates = Array.from({ length: weeks }, (_, i) => new Date(start + i * WEEK).toISOString().slice(0, 10));
  return { start, dates };
}

/** Counts ISO timestamps per week bin. Timestamps outside the grid are ignored. */
export function binCommits(stamps, start, weeks = 52) {
  const bins = new Array(weeks).fill(0);
  for (const t of stamps) {
    const w = Math.floor((new Date(t).getTime() - start) / WEEK);
    if (w >= 0 && w < weeks) bins[w] += 1;
  }
  return bins;
}

/** Radius of a repository atom: grows with the square root of recent commits and stars. */
export const atomRadius = (rep) => 13 + Math.sqrt(rep.commits * 1.6 + rep.stars * 6 + 1) * 3.4;

/** Places atoms on an expanding spiral, largest first, so that no two overlap and `gap` is left between them. Deterministic. */
export function layoutAtoms(repos, width, height, gap = 14) {
  const out = [];
  repos.forEach((rep, k) => {
    const r = atomRadius(rep);
    let a = k * 2.4;
    let dist = k === 0 ? 0 : 40;
    for (let guard = 0; guard < 500; guard++) {
      const x = width / 2 + Math.cos(a) * dist * 1.55;
      const y = height / 2 + Math.sin(a) * dist;
      if (out.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + gap)) {
        out.push({ x, y, r, rep });
        return;
      }
      a += 0.35;
      dist += 1.4;
    }
    out.push({ x: width / 2, y: height / 2, r, rep });
  });
  return out;
}

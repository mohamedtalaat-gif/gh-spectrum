// Pure helpers of gh-spectrum: time grid, binning, colours and layout. No DOM and no network, so they can be tested in Node.
export const DAY = 864e5;
export const WEEK = 7 * DAY;
export const PALETTE = ['#5b8dff', '#f08a4b', '#58c4a8', '#d6a96e', '#c07df0', '#ef6a70', '#8fb3d9', '#e0c94f'];

export const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const colourFor = (language) => PALETTE[hash(language) % PALETTE.length];
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * The weekly bins of the current calendar year (UTC): the first bin starts on the Sunday of the week that holds 1 January,
 * the last one is the week that holds `now`. `through` is today's date, `jan1` the first instant that counts.
 */
export function yearGrid(now = new Date()) {
  const year = now.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const start = jan1 - new Date(jan1).getUTCDay() * DAY;
  const today = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
  const weeks = Math.floor((today - start) / WEEK) + 1;
  const dates = Array.from({ length: weeks }, (_, i) => new Date(start + i * WEEK).toISOString().slice(0, 10));
  return { year, jan1, start, weeks, dates, through: new Date(today).toISOString().slice(0, 10) };
}

/** Counts ISO timestamps per week bin. Timestamps before `from` (default: the first bin) or after the last bin are ignored. */
export function binCommits(stamps, start, weeks, from = start) {
  const bins = new Array(weeks).fill(0);
  for (const t of stamps) {
    const ms = new Date(t).getTime();
    if (ms < from) continue;
    const w = Math.floor((ms - start) / WEEK);
    if (w >= 0 && w < weeks) bins[w] += 1;
  }
  return bins;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Axis ticks for the year so far: one per month that has begun, at its position in weeks; January carries the year. */
export function monthTicks({ year, dates, through }) {
  const start = Date.parse(dates[0]);
  const end = Date.parse(through);
  const out = [];
  for (let m = 0; m < 12; m++) {
    const t = Date.UTC(year, m, 1);
    if (t > end) break;
    out.push({ i: (t - start) / WEEK, label: m === 0 ? String(year) : MONTHS[m] });
  }
  return out;
}

/** Horizontal position of week `i` of `n` between `lo` and `hi`. Early in the year the weeks keep the width of a 13-week axis. */
export const MIN_SLOTS = 13;
export const slotX = (i, n, lo, hi) => lo + (i / (Math.max(n, MIN_SLOTS) - 1)) * (hi - lo);

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

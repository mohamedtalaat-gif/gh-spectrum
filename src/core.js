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

/** The scrolling spectrum gives every week the same width, so the year can be longer than the card and is moved sideways. */
export const WEEK_PX = 26;
export const SPEC_PAD = 28;
export const weekX = (i) => SPEC_PAD + i * WEEK_PX;
export const spectrumWidth = (n) => SPEC_PAD * 2 + Math.max(n - 1, 0) * WEEK_PX;

/**
 * A turn of the mouse wheel (vertical) over the spectrum moves it sideways. Returns the new scroll position, or null when the
 * wheel should do what it normally does: sideways gestures already scroll the element, and at either end the page scrolls on.
 */
export function wheelScroll({ deltaX = 0, deltaY = 0, deltaMode = 0, scrollLeft, max }) {
  if (!(max > 0) || Math.abs(deltaX) >= Math.abs(deltaY)) return null;
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1; // pixels, lines, pages
  const next = Math.min(max, Math.max(0, scrollLeft + deltaY * unit));
  return next === scrollLeft ? null : next;
}

/** Keys on the focused spectrum: the arrows move a few weeks, Page Up and Page Down most of a screen, Home and End go to the ends. */
export function keyScroll(key, { scrollLeft, max, page }) {
  const step = WEEK_PX * 4;
  const to = { ArrowLeft: scrollLeft - step, ArrowRight: scrollLeft + step, PageUp: scrollLeft - page * 0.8, PageDown: scrollLeft + page * 0.8, Home: 0, End: max }[key];
  return to === undefined ? null : Math.min(max, Math.max(0, to));
}

/** The week under a pointer at client position `x` over a spectrum whose left edge is at `left`, or null outside the weeks. */
export function weekAt({ x, left, scrollLeft, n }) {
  const i = Math.round((x - left + scrollLeft - SPEC_PAD) / WEEK_PX);
  return i >= 0 && i < n ? i : null;
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

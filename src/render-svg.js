// The card as a static SVG image, for places that cannot run scripts, such as a GitHub profile README.
// Pure: data in, string out. The interactive version is the <gh-activity> element.
import { colourFor, esc, layoutAtoms, monthTicks, slotX, weekStart } from './core.js';

export const THEMES = {
  dark: { bg: '#0e131c', border: '#2a3547', text: '#e1e8f2', muted: '#93a3ba', accent: '#5b8dff', hot: '#f08a4b' },
  light: { bg: '#ffffff', border: '#d3dae6', text: '#18243b', muted: '#566581', accent: '#2f5fd0', hot: '#d9622a' },
};

/** Scales and centres a layout so that every atom, with room for a label underneath, lies inside the box. */
function fit(pos, width, height) {
  if (!pos.length) return pos;
  const x0 = Math.min(...pos.map((p) => p.x - p.r)), x1 = Math.max(...pos.map((p) => p.x + p.r));
  const y0 = Math.min(...pos.map((p) => p.y - p.r)), y1 = Math.max(...pos.map((p) => p.y + p.r + 16));
  const k = Math.min(1, (width - 16) / (x1 - x0), (height - 8) / (y1 - y0));
  const ox = (width - (x1 - x0) * k) / 2 - x0 * k, oy = (height - (y1 - y0) * k) / 2 - y0 * k;
  return pos.map((p) => ({ ...p, x: p.x * k + ox, y: p.y * k + oy, r: p.r * k }));
}

const FONT = "'Barlow Semi Condensed', 'Helvetica Neue', Arial, sans-serif";

/**
 * options: theme ('dark' | 'light'), show (any of 'repos', 'commits', 'stars'), updated (a date string printed in the footer).
 */
export function renderCardSvg(d, { theme = 'dark', show = ['repos', 'commits', 'stars'], updated = '' } = {}) {
  const c = THEMES[theme] ?? THEMES.dark;
  const W = 760, PAD = 28, IW = W - PAD * 2;
  const total = d.weeks.reduce((a, b) => a + b, 0);
  const peak = Math.max(...d.weeks, 1);
  const bi = d.weeks.indexOf(peak);
  const stars = d.repos.reduce((a, r) => a + r.stars, 0);
  const langs = [...new Set(d.repos.map((r) => r.language))];

  // spectrum block
  const SH = 150, SB = 24, ST = 22;
  const n = d.weeks.length;
  const sx = (i) => slotX(i, n, 6, IW - 6);
  const sy = (v) => SH - SB - (v / peak) * (SH - SB - ST);
  let spec = `<line x1="0" x2="${IW}" y1="${SH - SB}" y2="${SH - SB}" stroke="${c.border}"/>`;
  const ticks = monthTicks(d);
  ticks.forEach((t) => { spec += `<line x1="${sx(t.i).toFixed(1)}" x2="${sx(t.i).toFixed(1)}" y1="${SH - SB}" y2="${SH - SB + 4}" stroke="${c.border}"/><text x="${sx(t.i).toFixed(1)}" y="${SH - 6}" text-anchor="${t.i < 1 ? 'start' : 'middle'}" class="m">${esc(t.label)}</text>`; });
  if (!ticks.length || sx(n - 1) - sx(ticks.at(-1).i) > 40) spec += `<text x="${sx(n - 1).toFixed(1)}" y="${SH - 6}" text-anchor="end" class="m">now</text>`;
  d.weeks.forEach((v, i) => {
    if (v > 0) spec += `<line x1="${sx(i).toFixed(1)}" x2="${sx(i).toFixed(1)}" y1="${SH - SB}" y2="${sy(v).toFixed(1)}" stroke="${c.accent}" stroke-width="2" stroke-linecap="round"/><circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="2.6" fill="${c.accent}"/>`;
  });
  if (total) spec += `<text x="${sx(bi).toFixed(1)}" y="${(sy(peak) - 8).toFixed(1)}" text-anchor="middle" class="t">base peak: ${peak}</text>`;

  // atoms block
  const AH = 280;
  const pos = fit(layoutAtoms(d.repos, IW, AH, 36), IW, AH); // the gap leaves room for labels that sit under small atoms
  let atoms = '';
  pos.forEach((p, i) => pos.slice(i + 1).forEach((q) => { if (p.rep.language === q.rep.language) atoms += `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${c.border}" stroke-width="1.5"/>`; }));
  pos.forEach((p) => {
    const col = colourFor(p.rep.language);
    const name = p.rep.name.length > 18 ? `${p.rep.name.slice(0, 17)}\u2026` : p.rep.name;
    const fs = Math.max(9, Math.min(12, p.r / 3.1));
    const fits = name.length * fs * 0.52 < p.r * 1.8; // a label that is wider than its atom goes underneath
    const ly = fits ? p.y + 4 : p.y + p.r + fs + 3;
    atoms += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="2"/><text x="${p.x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" class="${fits ? 't' : 'm'}" style="font-size:${fs.toFixed(1)}px">${esc(name)}</text>`;
  });

  // legend
  let lx = 0;
  const legend = langs.map((l) => {
    const item = `<circle cx="${lx + 5}" cy="0" r="5" fill="${colourFor(l)}"/><text x="${lx + 15}" y="4" class="m">${esc(l)}</text>`;
    lx += 26 + l.length * 6.4;
    return item;
  }).join('');

  const totals = [
    show.includes('commits') ? `${total} commits in ${d.year}` : '',
    show.includes('repos') ? `${d.repos.length} repositories` : '',
    show.includes('stars') ? `${stars} stars` : '',
  ].filter(Boolean).join('   ');

  const y1 = PAD + 22;            // header baseline
  const y2 = y1 + 34;             // spectrum label
  const y3 = y2 + 8;              // spectrum top
  const y4 = y3 + SH + 26;        // atoms label
  const y5 = y4 + 8;              // atoms top
  const y6 = y5 + AH + 22;        // legend
  const H = y6 + 44;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">GitHub activity of ${esc(d.user)}</title>
<desc id="d">Commits per week in ${d.year}, base peak ${peak} in the week of ${esc(weekStart(d, bi))}, and ${d.repos.length} repositories drawn as atoms.</desc>
<style>text{font-family:${FONT}} .t{fill:${c.text};font-size:12px} .m{fill:${c.muted};font-size:11px} .h{fill:${c.text};font-size:19px;font-weight:600} .s{fill:${c.muted};font-size:14px}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${c.bg}" stroke="${c.border}"/>
<text x="${PAD}" y="${y1}" class="h">github.com/${esc(d.user)}</text>
<text x="${W - PAD}" y="${y1}" text-anchor="end" class="s">${esc(totals)}</text>
<text x="${PAD}" y="${y2}" class="s">Spectrum of Commits</text>
<g transform="translate(${PAD} ${y3})">${spec}</g>
<text x="${PAD}" y="${y4}" class="s">Repositories as atoms</text>
<g transform="translate(${PAD} ${y5})">${atoms}</g>
<g transform="translate(${PAD} ${y6})">${legend}</g>
<text x="${PAD}" y="${H - 16}" class="m">Data: GitHub REST API${updated ? `, ${esc(updated)}` : ''}. Radius reflects commits in ${d.year} plus stars; bonds join repositories that share a language.</text>
</svg>
`;
}

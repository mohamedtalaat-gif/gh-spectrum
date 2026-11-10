/*!
 * gh-spectrum: a GitHub activity card drawn like an analytical spectrum.
 * Commits per week are stick peaks along the year so far (like a mass spectrum, base peak labelled);
 * repositories are atoms sized by recent activity and coloured by language, bonded by shared language.
 * No dependencies. Data come from the public GitHub REST API in the visitor's browser and are cached for an hour.
 * MIT licence.
 */
import { colourFor, esc, layoutAtoms, monthTicks, slotX } from './core.js';
import { fetchActivity } from './data.js';

const TTL = 60 * 60 * 1000;

// The browser keeps the result for an hour so that a page with the card does not use up the visitor's API allowance.
// The year is part of the key, so a new year starts from fresh data.
async function load(user, include) {
  const key = `gh-spectrum:${new Date().getUTCFullYear()}:${user}:${include ? include.join(',') : '*'}`;
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null');
    if (c && Date.now() - c.at < TTL) return c.data;
  } catch {}
  const data = await fetchActivity({ user, include });
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
  return data;
}

const CSS = `
:host { display: block; font-family: var(--ghs-font, system-ui, sans-serif); color: var(--ghs-text, #e1e8f2); }
.card { border: 1px solid var(--ghs-rule, #2a3547); border-radius: 8px; background: var(--ghs-bg, transparent); padding: 1.1rem 1.2rem 1rem; }
header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem 1.2rem; margin-bottom: 0.8rem; }
header a { color: inherit; font-weight: 600; font-size: 1.15rem; text-decoration: none; }
header a:hover { text-decoration: underline; }
.totals { color: var(--ghs-muted, #93a3ba); font-size: 0.95rem; display: flex; gap: 1.1rem; flex-wrap: wrap; }
.totals strong { color: var(--ghs-text, #e1e8f2); font-variant-numeric: tabular-nums; }
h4 { margin: 1rem 0 0.2rem; font-size: 0.95rem; font-weight: 600; color: var(--ghs-muted, #93a3ba); }
svg { width: 100%; height: auto; display: block; overflow: visible; }
svg text { font-family: inherit; font-size: 11px; fill: var(--ghs-muted, #93a3ba); }
.axis { stroke: var(--ghs-rule, #2a3547); }
.peak { stroke: var(--ghs-accent, #5b8dff); stroke-width: 2; stroke-linecap: round; transition: stroke 0.15s; }
.peak.on { stroke: var(--ghs-hot, #f08a4b); stroke-width: 3; }
.cap { fill: var(--ghs-accent, #5b8dff); }
.cap.on { fill: var(--ghs-hot, #f08a4b); }
.hit { fill: transparent; cursor: crosshair; }
.atom { cursor: pointer; transition: opacity 0.2s, transform 0.2s; transform-box: fill-box; transform-origin: center; }
.atom:hover, .atom:focus { transform: scale(1.08); outline: none; }
.atom.dim { opacity: 0.18; }
.bond { stroke: var(--ghs-rule, #2a3547); stroke-width: 1.5; transition: opacity 0.2s; }
.bond.dim { opacity: 0.1; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0 0; }
.chip { font: inherit; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0.65rem; border: 1px solid var(--ghs-rule, #2a3547); border-radius: 99px; background: none; color: var(--ghs-muted, #93a3ba); cursor: pointer; }
.chip:hover { color: var(--ghs-text, #e1e8f2); }
.chip[aria-pressed='true'] { color: var(--ghs-text, #e1e8f2); border-color: var(--ghs-muted, #93a3ba); }
.chip i { width: 0.6rem; height: 0.6rem; border-radius: 50%; display: inline-block; }
.tip { min-height: 2.6rem; margin-top: 0.6rem; font-size: 0.9rem; color: var(--ghs-muted, #93a3ba); }
.tip strong { color: var(--ghs-text, #e1e8f2); }
.note { margin: 0.8rem 0 0; font-size: 0.8rem; color: var(--ghs-muted, #93a3ba); }
.err { color: var(--ghs-muted, #93a3ba); font-size: 0.95rem; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

class GhActivity extends HTMLElement {
  connectedCallback() {
    this.root = this.attachShadow({ mode: 'open' });
    this.user = this.getAttribute('user');
    this.include = this.getAttribute('repos')?.split(',').map((s) => s.trim()).filter(Boolean) || null;
    // Which headline figures to print beside the user name: any of repos, commits, stars (default: all three).
    this.show = (this.getAttribute('show') ?? 'repos,commits,stars').split(',').map((s) => s.trim());
    this.root.innerHTML = `<style>${CSS}</style><div class="card"><p class="err">Loading activity for ${esc(this.user)}…</p></div>`;
    load(this.user, this.include).then((d) => this.render(d)).catch((e) => this.fail(e));
  }
  fail(e) {
    this.root.querySelector('.card').innerHTML = `<header><a href="https://github.com/${esc(this.user)}">github.com/${esc(this.user)}</a></header><p class="err">The GitHub API did not answer (${esc(e.message.slice(0, 40))}). Visit the profile for the live activity.</p>`;
  }
  render(d) {
    const total = d.weeks.reduce((a, b) => a + b, 0);
    const peak = Math.max(...d.weeks, 1);
    const bi = d.weeks.indexOf(peak);
    const langs = [...new Set(d.repos.map((r) => r.language))];
    const colour = colourFor;
    const stars = d.repos.reduce((a, r) => a + r.stars, 0);

    // spectrum
    const W = 720, H = 170, L = 8, B = 26, T = 22;
    const n = d.weeks.length;
    const x = (i) => slotX(i, n, L + 6, W - L - 6);
    const y = (v) => H - B - (v / peak) * (H - B - T);
    let sp = `<line class="axis" x1="${L}" x2="${W - L}" y1="${H - B}" y2="${H - B}"/>`;
    const ticks = monthTicks(d);
    ticks.forEach((t) => { sp += `<line class="axis" x1="${x(t.i)}" x2="${x(t.i)}" y1="${H - B}" y2="${H - B + 4}"/><text x="${x(t.i)}" y="${H - 8}" text-anchor="${t.i < 1 ? 'start' : 'middle'}">${esc(t.label)}</text>`; });
    if (!ticks.length || x(n - 1) - x(ticks.at(-1).i) > 40) sp += `<text x="${x(n - 1)}" y="${H - 8}" text-anchor="end">now</text>`;
    d.weeks.forEach((v, i) => {
      if (v > 0) sp += `<line class="peak" data-i="${i}" x1="${x(i)}" x2="${x(i)}" y1="${H - B}" y2="${y(v)}"/><circle class="cap" data-i="${i}" cx="${x(i)}" cy="${y(v)}" r="2.6"/>`;
      sp += `<rect class="hit" data-i="${i}" x="${x(i) - 5}" y="${T - 6}" width="10" height="${H - B - T + 6}"/>`;
    });
    if (total) sp += `<text x="${x(bi)}" y="${y(peak) - 8}" text-anchor="middle" style="fill:var(--ghs-text,#e1e8f2)">base peak: ${peak}</text>`;

    // atoms: spiral placement by size, bonds between repositories that share a language
    const AW = 720, AH = 230;
    const pos = layoutAtoms(d.repos, AW, AH);
    let at = '';
    pos.forEach((p, i) => pos.slice(i + 1).forEach((q) => { if (p.rep.language === q.rep.language) at += `<line class="bond" data-l="${esc(p.rep.language)}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`; }));
    pos.forEach((p) => {
      const c = colour(p.rep.language);
      at += `<g class="atom" tabindex="0" role="link" data-l="${esc(p.rep.language)}" data-n="${esc(p.rep.name)}"><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="2"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" style="fill:var(--ghs-text,#e1e8f2);font-size:${Math.max(9, Math.min(12, p.r / 3.1))}px">${esc(p.rep.name.length > 14 ? p.rep.name.slice(0, 13) + '…' : p.rep.name)}</text></g>`;
    });

    const alt = d.weeks.map((v, i) => `${d.dates[i]}: ${v}`).join('; ');
    this.root.querySelector('.card').innerHTML = `
      <header><a href="https://github.com/${esc(d.user)}">github.com/${esc(d.user)}</a>
        <span class="totals">${this.show.includes('commits') ? `<span><strong>${total}</strong> commits in ${d.year}</span>` : ''}${this.show.includes('repos') ? `<span><strong>${d.repos.length}</strong> repositories</span>` : ''}${this.show.includes('stars') ? `<span><strong>${stars}</strong> stars</span>` : ''}</span></header>
      <h4>Spectrum of Commits</h4>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Commits per week in ${d.year}. Base peak ${peak} in the week of ${esc(d.dates[bi])}."><title>Commits in ${d.year}</title>${sp}</svg>
      <span class="sr">${esc(alt)}</span>
      <h4>Repositories as atoms</h4>
      <svg viewBox="0 0 ${AW} ${AH}" role="group" aria-label="Repositories; radius grows with recent commits and stars">${at}</svg>
      <div class="chips" role="group" aria-label="Filter by language">${langs.map((l) => `<button type="button" class="chip" aria-pressed="false" data-l="${esc(l)}"><i style="background:${colour(l)}"></i>${esc(l)}</button>`).join('')}</div>
      <div class="tip" aria-live="polite">Hover a peak or an atom.</div>
      <p class="note">Data: GitHub REST API, requested by your browser and cached for an hour. Radius reflects commits in ${d.year} plus stars; bonds join repositories that share a language.</p>`;

    const tip = this.root.querySelector('.tip');
    const setPeak = (i) => {
      this.root.querySelectorAll('.peak,.cap').forEach((n) => n.classList.toggle('on', Number(n.dataset.i) === i));
      if (i != null) tip.innerHTML = `<strong>Week of ${esc(d.dates[i])}</strong>: ${d.weeks[i]} commit${d.weeks[i] === 1 ? '' : 's'}`;
    };
    this.root.querySelectorAll('.hit').forEach((h) => { h.addEventListener('pointerenter', () => setPeak(Number(h.dataset.i))); });
    this.root.querySelectorAll('.atom').forEach((a) => {
      const rep = d.repos.find((q) => q.name === a.dataset.n);
      const about = (rep.description || 'no description').replace(/[.\s]+$/, '');
      const show = () => (tip.innerHTML = `<strong>${esc(rep.name)}</strong> (${esc(rep.language)}): ${esc(about)}. ${rep.commits} commits in ${d.year}, ${rep.stars} star${rep.stars === 1 ? '' : 's'}, last push ${esc(rep.pushed.slice(0, 10))}.`);
      a.addEventListener('pointerenter', show);
      a.addEventListener('focus', show);
      a.addEventListener('click', () => (location.href = rep.url));
      a.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.href = rep.url; });
    });
    this.root.querySelectorAll('.chip').forEach((c) =>
      c.addEventListener('click', () => {
        const on = c.getAttribute('aria-pressed') !== 'true';
        this.root.querySelectorAll('.chip').forEach((o) => o.setAttribute('aria-pressed', 'false'));
        c.setAttribute('aria-pressed', String(on));
        this.root.querySelectorAll('.atom,.bond').forEach((n) => n.classList.toggle('dim', on && n.dataset.l !== c.dataset.l));
      })
    );
  }
}
if (!customElements.get('gh-activity')) customElements.define('gh-activity', GhActivity);
export { GhActivity };

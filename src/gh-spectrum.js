/*!
 * gh-spectrum: a GitHub activity card drawn like an analytical spectrum.
 * Commits per week are stick peaks along the year so far (like a mass spectrum, base peak labelled); the spectrum scrolls
 * sideways through the months with the wheel, a drag or the arrow keys;
 * repositories are atoms sized by recent activity and coloured by language, bonded by shared language.
 * No dependencies. Data come from the public GitHub REST API in the visitor's browser and are cached for an hour.
 * MIT licence.
 */
import { colourFor, esc, layoutAtoms, monthTicks, weekX, spectrumWidth, WEEK_PX, wheelScroll, keyScroll, weekAt, flagLeft, weekStart } from './core.js';
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
.spec { overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; cursor: grab; scrollbar-width: thin; scrollbar-color: var(--ghs-rule, #2a3547) transparent; border-radius: 4px; }
.spec.drag { cursor: grabbing; user-select: none; }
.spec:focus-visible { outline: 2px solid var(--ghs-accent, #5b8dff); outline-offset: 2px; }
.spec svg { max-width: none; overflow: visible; }
.band { fill: var(--ghs-accent, #5b8dff); fill-opacity: 0.14; pointer-events: none; }
.flag { pointer-events: none; }
.flag rect { fill: var(--ghs-flag-bg, var(--ghs-bg, #0e131c)); stroke: var(--ghs-hot, #f08a4b); stroke-width: 1; }
.flag text { fill: var(--ghs-text, #e1e8f2); font-size: 12px; }
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
    // Every week has the same width, so the year can be wider than the card; the card scrolls it sideways.
    const H = 170, B = 26, T = 34;
    const n = d.weeks.length;
    const W = spectrumWidth(n);
    const x = weekX;
    const y = (v) => H - B - (v / peak) * (H - B - T);
    let sp = `<rect class="band" opacity="0" x="0" y="${T - 12}" width="${WEEK_PX}" height="${H - B - T + 12}"/><line class="axis" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/>`;
    const ticks = monthTicks(d);
    ticks.forEach((t) => { sp += `<line class="axis" x1="${x(t.i)}" x2="${x(t.i)}" y1="${H - B}" y2="${H - B + 4}"/><text x="${x(t.i)}" y="${H - 8}" text-anchor="middle">${esc(t.label)}</text>`; });
    if (!ticks.length || x(n - 1) - x(ticks.at(-1).i) > 40) sp += `<text x="${x(n - 1)}" y="${H - 8}" text-anchor="end">now</text>`;
    d.weeks.forEach((v, i) => {
      if (v > 0) sp += `<line class="peak" data-i="${i}" x1="${x(i)}" x2="${x(i)}" y1="${H - B}" y2="${y(v)}"/><circle class="cap" data-i="${i}" cx="${x(i)}" cy="${y(v)}" r="2.6"/>`;
    });
    if (total) {
      const bx = x(bi), edge = bx > W - 70 ? 'end' : bx < 70 ? 'start' : 'middle'; // keep the label inside the picture
      sp += `<text class="base" x="${edge === 'end' ? bx + 6 : edge === 'start' ? bx - 6 : bx}" y="${y(peak) - 8}" text-anchor="${edge}" style="fill:var(--ghs-text,#e1e8f2)">base peak: ${peak}</text>`;
    }
    sp += `<g class="flag" opacity="0"><rect x="0" y="1" width="10" height="22" rx="4"/><text x="0" y="16"></text></g>`;

    // atoms: spiral placement by size, bonds between repositories that share a language
    const AW = 720, AH = 230;
    const pos = layoutAtoms(d.repos, AW, AH);
    let at = '';
    pos.forEach((p, i) => pos.slice(i + 1).forEach((q) => { if (p.rep.language === q.rep.language) at += `<line class="bond" data-l="${esc(p.rep.language)}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`; }));
    pos.forEach((p) => {
      const c = colour(p.rep.language);
      at += `<g class="atom" tabindex="0" role="link" data-l="${esc(p.rep.language)}" data-n="${esc(p.rep.name)}"><circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="2"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" style="fill:var(--ghs-text,#e1e8f2);font-size:${Math.max(9, Math.min(12, p.r / 3.1))}px">${esc(p.rep.name.length > 14 ? p.rep.name.slice(0, 13) + '…' : p.rep.name)}</text></g>`;
    });

    const alt = d.weeks.map((v, i) => `${weekStart(d, i)}: ${v}`).join('; ');
    this.root.querySelector('.card').innerHTML = `
      <header><a href="https://github.com/${esc(d.user)}">github.com/${esc(d.user)}</a>
        <span class="totals">${this.show.includes('commits') ? `<span><strong>${total}</strong> commits in ${d.year}</span>` : ''}${this.show.includes('repos') ? `<span><strong>${d.repos.length}</strong> repositories</span>` : ''}${this.show.includes('stars') ? `<span><strong>${stars}</strong> stars</span>` : ''}</span></header>
      <h4>Spectrum of Commits</h4>
      <div class="spec" tabindex="0" role="group" aria-label="Spectrum of Commits; use the arrow keys, the wheel or a drag to move through the months">
        <svg viewBox="0 0 ${W} ${H}" style="width:${W}px" role="img" aria-label="Commits per week in ${d.year}. Base peak ${peak} in the week of ${esc(weekStart(d, bi))}."><title>Commits in ${d.year}</title>${sp}</svg>
      </div>
      <span class="sr">${esc(alt)}</span>
      <h4>Repositories as atoms</h4>
      <svg viewBox="0 0 ${AW} ${AH}" role="group" aria-label="Repositories; radius grows with recent commits and stars">${at}</svg>
      <div class="chips" role="group" aria-label="Filter by language">${langs.map((l) => `<button type="button" class="chip" aria-pressed="false" data-l="${esc(l)}"><i style="background:${colour(l)}"></i>${esc(l)}</button>`).join('')}</div>
      <div class="tip" aria-live="polite">Hover a peak or an atom. Scroll or drag the spectrum to move through the months.</div>
      <p class="note">Data: GitHub REST API, requested by your browser and cached for an hour. Radius reflects commits in ${d.year} plus stars; bonds join repositories that share a language.</p>`;

    const tip = this.root.querySelector('.tip');
    const setPeak = (i) => {
      this.root.querySelectorAll('.peak,.cap').forEach((n) => n.classList.toggle('on', Number(n.dataset.i) === i));
      if (i != null) tip.innerHTML = `<strong>Week of ${esc(weekStart(d, i))}</strong>: ${d.weeks[i]} commit${d.weeks[i] === 1 ? '' : 's'}`;
    };

    // The spectrum starts at the present and moves sideways: wheel, drag with the mouse, swipe, or the arrow keys when focused.
    const spec = this.root.querySelector('.spec');
    const max = () => spec.scrollWidth - spec.clientWidth;
    const toNow = () => { spec.scrollLeft = spec.scrollWidth; };
    toNow();
    requestAnimationFrame(toNow);
    spec.addEventListener('wheel', (e) => {
      const next = wheelScroll({ deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, scrollLeft: spec.scrollLeft, max: max() });
      if (next === null) return; // at an end, or a sideways gesture: the browser does the rest
      e.preventDefault();
      spec.scrollLeft = next;
    }, { passive: false });
    spec.addEventListener('keydown', (e) => {
      const next = keyScroll(e.key, { scrollLeft: spec.scrollLeft, max: max(), page: spec.clientWidth });
      if (next === null) return;
      e.preventDefault();
      spec.scrollLeft = next;
    });

    // The week under the pointer comes from the pointer's position, not from the element it entered, so it also follows the
    // wheel, a drag and a swipe while the pointer rests, which browsers do not report as pointer events.
    const band = spec.querySelector('.band'), flag = spec.querySelector('.flag');
    const flagBox = flag.querySelector('rect'), flagText = flag.querySelector('text');
    const baseLabel = spec.querySelector('.base');
    const place = (i) => {
      baseLabel?.setAttribute('opacity', i === bi ? '0' : '1'); // the label of the week takes its place
      band.setAttribute('opacity', i === null ? '0' : '1');
      flag.setAttribute('opacity', i === null ? '0' : '1');
      if (i === null) return;
      band.setAttribute('x', x(i) - WEEK_PX / 2);
      flagText.textContent = `Week of ${weekStart(d, i)}: ${d.weeks[i]} commit${d.weeks[i] === 1 ? '' : 's'}`;
      const w = flagText.getBBox().width + 16;
      const left = flagLeft({ center: x(i), width: w, from: spec.scrollLeft, to: spec.scrollLeft + spec.clientWidth });
      flagBox.setAttribute('x', left);
      flagBox.setAttribute('width', w);
      flagText.setAttribute('x', left + 8);
    };
    let pointerX = null;
    let shown = null;
    const hover = () => {
      const i = pointerX === null ? null : weekAt({ x: pointerX, left: spec.getBoundingClientRect().left, scrollLeft: spec.scrollLeft, n });
      if (i !== shown) { shown = i; setPeak(i); }
      place(i); // also while the spectrum moves under a pointer that rests: the label keeps inside the visible part
    };
    let drag = null;
    const endDrag = () => { spec.classList.remove('drag'); drag = null; };
    spec.addEventListener('pointerdown', (e) => {
      endDrag();
      pointerX = e.clientX; // a press or a tap names the week too, which is how a touch screen reads it
      hover();
      if (e.pointerType === 'mouse' && e.button === 0) drag = { x: e.clientX, left: spec.scrollLeft, moved: false };
    });
    spec.addEventListener('pointermove', (e) => {
      pointerX = e.clientX;
      if (drag && (e.buttons & 1) === 0) endDrag(); // the button was released where this element could not hear it
      if (drag) {
        const dx = e.clientX - drag.x;
        if (drag.moved || Math.abs(dx) >= 4) { // a click or a hover is not a drag
          if (!drag.moved) { drag.moved = true; spec.classList.add('drag'); spec.setPointerCapture(e.pointerId); }
          spec.scrollLeft = drag.left - dx;
        }
      }
      hover();
    });
    spec.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') { pointerX = null; hover(); } });
    spec.addEventListener('scroll', hover);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => spec.addEventListener(t, endDrag));

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

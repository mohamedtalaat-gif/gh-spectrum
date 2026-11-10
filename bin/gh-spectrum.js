#!/usr/bin/env node
// Usage: gh-spectrum <user> (--out card.svg | --out-dir dir) [--theme dark|light] [--repos a,b] [--show repos,commits,stars]
// With --out-dir the dark and the light card are written as gh-spectrum-dark.svg and gh-spectrum-light.svg.
// Set GITHUB_TOKEN to raise the API rate limit (the token needs no scopes for public data).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fetchActivity } from '../src/data.js';
import { renderCardSvg } from '../src/render-svg.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const user = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!user || (!flag('out') && !flag('out-dir'))) {
  console.error('usage: gh-spectrum <user> (--out card.svg | --out-dir dir) [--theme dark|light] [--repos a,b] [--show repos,commits,stars]');
  process.exit(2);
}

try {
  const data = await fetchActivity({
    user,
    include: flag('repos')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null,
    token: process.env.GITHUB_TOKEN ?? null,
  });
  const show = (flag('show') ?? 'repos,commits,stars').split(',').map((s) => s.trim());
  const updated = new Date().toISOString().slice(0, 10);
  if (flag('out')) {
    writeFileSync(flag('out'), renderCardSvg(data, { theme: flag('theme') ?? 'dark', show, updated }));
    console.log(`wrote ${flag('out')}`);
  } else {
    const dir = flag('out-dir');
    mkdirSync(dir, { recursive: true });
    for (const theme of ['dark', 'light']) writeFileSync(join(dir, `gh-spectrum-${theme}.svg`), renderCardSvg(data, { theme, show, updated }));
    console.log(`wrote gh-spectrum-dark.svg and gh-spectrum-light.svg to ${dir}`);
  }
} catch (e) {
  console.error(`gh-spectrum: ${e.message}`);
  process.exit(1);
}

# gh-spectrum

A GitHub activity card that reads like an analytical spectrum. Weekly commits are stick peaks along a one-year time axis, as in a mass spectrum, with the base peak labelled. Each repository is an atom: its radius grows with recent commits and stars, its colour follows the primary language, and repositories that share a language are bonded. Language chips filter the atoms.

It is one custom element, `<gh-activity>`, with no dependencies and no build step. The same card can also be written as a static SVG, for places that cannot run scripts, such as a GitHub profile README.

```html
<gh-activity user="your-github-login"></gh-activity>
<script type="module" src="https://cdn.jsdelivr.net/gh/mohamedtalaat-gif/gh-spectrum@1.0.0/src/gh-spectrum.js"></script>
```

The element loads `core.js` from the same folder, so serve both files together. A page opened from `file://` cannot load ES modules; use any static server for local work (`npx serve`, `python3 -m http.server`).

## Attributes

| Attribute | Meaning | Default |
|---|---|---|
| `user` | GitHub login to draw | required |
| `repos` | Comma-separated repository names to include | all public, non-fork repositories |
| `show` | Headline figures beside the login: any of `repos`, `commits`, `stars` | `repos,commits,stars` |

Colours and the font come from custom properties set on the element: `--ghs-text`, `--ghs-muted`, `--ghs-rule`, `--ghs-bg`, `--ghs-accent`, `--ghs-hot`, `--ghs-font`.

## As an image for a profile README

A README cannot run a web component, so the command line writes the card as an SVG, in a dark and a light version.

```bash
GITHUB_TOKEN=... npx github:mohamedtalaat-gif/gh-spectrum#1.1.0 your-login --out-dir cards --show repos
# writes cards/gh-spectrum-dark.svg and cards/gh-spectrum-light.svg
```

| Option | Meaning |
|---|---|
| `--out card.svg` or `--out-dir dir` | One file, or the dark and the light card together |
| `--theme dark\|light` | Theme for `--out` (default dark) |
| `--repos a,b` | Only these repositories |
| `--show repos,commits,stars` | Headline figures to print (default all three) |

`GITHUB_TOKEN` is optional; any token, even one without scopes, raises the API limit from 60 to 5000 requests an hour. In a GitHub Actions job the built-in `secrets.GITHUB_TOKEN` is enough.

The README then picks the version that matches the reader's theme:

```html
<a href="https://example.org/where-the-interactive-card-lives">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://example.org/gh-spectrum-dark.svg">
    <img alt="GitHub activity: weekly commits as a spectrum, repositories as atoms" src="https://example.org/gh-spectrum-light.svg" width="720">
  </picture>
</a>
```

Host the two files anywhere that serves them over HTTPS, for instance on a GitHub Pages site that a scheduled workflow rebuilds once a week. That keeps the card current without adding commits to the profile repository. The static card has no hover; the interactive card is the element above.

## Why not a stats image

A stats image is rendered on a server, cannot respond to the pointer and needs a token for anything private. This card runs in the visitor's browser against the public GitHub REST API, answers hover, focus and keyboard input, and keeps a text alternative of the weekly counts for screen readers.

## How it works

- `GET /users/{user}/repos` lists the public, non-fork repositories.
- `GET /repos/{user}/{repo}/commits?since=...` lists the commits of the last year, a hundred per page and at most five pages per repository. The dates are binned into 52 weeks that start on Sunday (UTC) and summed across repositories.
- The result is cached in `localStorage` for one hour. The unauthenticated API allows 60 requests an hour per visitor, which covers a profile with a handful of repositories. If the API does not answer, the card says so and links to the profile.
- `src/data.js` fetches and bins the data for the element and the command line, `src/render-svg.js` draws the static card, and `src/core.js` holds the parts that need no browser: the week grid, the binning, the colour rule and the atom layout. `npm test` runs their tests in Node, the fetcher against a fake API.

## Limits

Commit counts come from the default branch of each repository, include every author and stop at 500 commits per repository. That suits personal repositories and over-counts shared ones. The language is GitHub's primary language for the repository. A repository with no commits in the last year is drawn at the minimum size.

## Development

```bash
npm test                      # unit tests, Node 20 or newer
python3 -m http.server 4401   # then open http://localhost:4401/demo/
```

## Licence

MIT. See `LICENSE`.

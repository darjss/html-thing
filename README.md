# html-thing

One-command HTML hosting on Cloudflare R2. Upload an HTML file and get a public URL on `html.darjs.dev`.

## Prerequisites

- [wrangler](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated (`wrangler login`)
- A Cloudflare account with R2 access
- A custom domain zone on Cloudflare (defaults to `darjs.dev`)

## Install

```bash
npm install -g html-thing
```

Or run directly with npx / bunx.

## Usage

```bash
html-thing page.html
# → https://html.darjs.dev/kqBIbC

html-thing page.html --name my-page
# → https://html.darjs.dev/my-page

html-thing page.html --bucket my-bucket --domain files.example.com
# → https://files.example.com/<slug>
```

### Flags

| Flag              | Default          | Description                               |
| ----------------- | ---------------- | ----------------------------------------- |
| `--name <slug>`   | random 6-char    | Use a custom slug instead of a random one |
| `--bucket <name>` | `html-thing`     | R2 bucket name (created if missing)       |
| `--domain <host>` | `html.darjs.dev` | Custom domain attached to the bucket      |

## How it works

1. Ensures the R2 bucket exists (creates it if missing).
2. Ensures the custom domain is attached to the bucket (resolves the zone ID via the Cloudflare API).
3. Generates a random 6-character base62 slug, checking for collisions.
4. Uploads the file with `content-type: text/html; charset=utf-8`.
5. Prints the public URL.

## Development

```bash
vp install      # install deps
vp check        # format, lint, typecheck
vp pack         # build to dist/
```

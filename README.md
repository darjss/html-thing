# html-thing

One-command HTML hosting on Cloudflare R2. Upload an HTML file and get a public URL — by default on `https://html.darjs.dev/<slug>`.

`html-thing` is a small CLI (and importable library) that wraps the Cloudflare R2 workflow into a single step: it makes sure the bucket exists, makes sure the custom domain is attached, picks a collision-free slug, uploads the file as `text/html`, and prints the URL.

## Prerequisites

- [wrangler](https://developers.cloudflare.com/workers/wrangler/) installed and authenticated (`wrangler login`), **or** a `CLOUDFLARE_API_TOKEN` env var set.
- A Cloudflare account with R2 access.
- A Cloudflare zone for the parent domain you want to serve from (defaults to `darjs.dev`).

## Install

```bash
npm install -g html-thing
```

Or run directly with `npx html-thing` / `bunx html-thing`.

## Usage

```bash
html-thing page.html
# → https://html.darjs.dev/kqBIbC

html-thing page.html --name my-page
# → https://html.darjs.dev/my-page

html-thing page.html --bucket my-bucket --domain files.example.com
# → https://files.example.com/<slug>
```

Run `html-thing --help` (or `-h`, or no arguments) for the built-in help.

### Flags

| Flag              | Default          | Description                                          |
| ----------------- | ---------------- | ---------------------------------------------------- |
| `--name <slug>`   | random 6-char    | Use a custom slug instead of a random one            |
| `--bucket <name>` | `html-thing`     | R2 bucket name (created if missing, location `enam`) |
| `--domain <host>` | `html.darjs.dev` | Custom domain attached to the bucket                 |

Flags accept either `--flag value` or `--flag=value` form. Exactly one HTML file is expected as the positional argument.

## How it works

For each upload, `html-thing` runs through these steps (all via the `wrangler` CLI):

1. **Ensure the bucket exists** — `wrangler r2 bucket info` is probed; if it fails, the bucket is created with `wrangler r2 bucket create --location=enam`.
2. **Ensure the custom domain is attached** — `wrangler r2 bucket domain list` is checked; if the domain isn't listed, the parent zone ID is resolved via the Cloudflare REST API (`GET /zones?name=<parent>`) and the domain is attached with `wrangler r2 bucket domain add --zone-id=<id>`.
3. **Pick a slug** — a random base62 slug (6 chars by default) is generated with `crypto.getRandomValues`; collisions are checked with `wrangler r2 object get --pipe --remote` (up to 10 retries). A custom `--name` slug is used as-is but still checked for collisions.
4. **Upload** — `wrangler r2 object put` with `--content-type=text/html; charset=utf-8 --remote`.
5. **Print the URL** — `https://<domain>/<slug>`.

### API token resolution

The Cloudflare API token is resolved in this order:

1. `CLOUDFLARE_API_TOKEN` env var.
2. wrangler's OAuth token, read from `~/.config/.wrangler/config/default.toml` or `~/.wrangler/config/default.toml`.

If neither is available, the command fails with a message telling you to set the env var or run `wrangler login`.

## Library API

The CLI is a thin wrapper over the library exported from `src/index.ts`. You can import it directly:

```ts
import { host, generateSlug } from "html-thing";

const url = await host("page.html", { name: "my-page" });
// → "https://html.darjs.dev/my-page"
```

Key exports:

- `host(filePath, options?)` — the one-shot upload; returns the public URL.
- `generateSlug(length?)` — random base62 slug.
- `freeSlug(bucket, length?, maxTries?)` — slug guaranteed free in the bucket.
- `ensureBucket(bucket, location?)`, `ensureCustomDomain(bucket, domain, parentDomain)`, `upload(bucket, slug, filePath)` — the individual steps, usable on their own.
- `resolveApiToken()`, `resolveZoneId(parentDomain)` — Cloudflare auth/zone helpers.
- `wrangler(...args)`, `wranglerOk(...args)` — thin `spawnSync` wrappers around the `wrangler` CLI.

`UploadOptions`: `{ bucket?, domain?, slug?, slugLength? }`.

## Project structure

```
src/
  index.ts   # library: bucket/domain/slug/upload logic + wrangler wrappers
  cli.ts     # bin entry: arg parsing, calls host(), prints URL
tests/
  index.test.ts   # unit tests for generateSlug
```

Build output goes to `dist/` (`dist/cli.mjs` is the published `bin`, `dist/index.mjs` is the library export).

## Tech stack

- **TypeScript** (ESM), built with [Vite+](https://viteplus.dev/guide/) (`vp pack` → `tsdown`).
- **Node.js** standard library only (`child_process`, `fs`, `os`, `path`, `crypto`) — no runtime deps.
- **wrangler** CLI as the R2/Cloudflare interface (called via `spawnSync`).
- **Vitest** (via `vite-plus/test`) for tests; Oxlint + Oxfmt via `vp check`.

## Development

This repo uses the `vp` (Vite+) toolchain. Commands (from `package.json` scripts):

```bash
vp install      # install deps (pnpm)
vp check        # format, lint, typecheck
vp test         # run tests
vp pack         # build to dist/  (npm run build)
vp pack --watch # rebuild on change (npm run dev)
```

## License

MIT

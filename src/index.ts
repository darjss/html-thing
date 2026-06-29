import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_BUCKET = "html-thing";
export const DEFAULT_DOMAIN = "html.darjs.dev";
export const DEFAULT_PARENT_DOMAIN = "darjs.dev";
export const SLUG_LENGTH = 6;
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export interface UploadOptions {
  bucket?: string;
  domain?: string;
  slug?: string;
  slugLength?: number;
}

/** Generate a random base62 slug. */
export function generateSlug(length: number = SLUG_LENGTH): string {
  let slug = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    slug += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length];
  }
  return slug;
}

/** Run a wrangler command, returning stdout. Throws on non-zero exit. */
export function wrangler(...args: string[]): string {
  const result = spawnSync("wrangler", args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || "").trim();
    throw new Error(`wrangler ${args.join(" ")} failed (exit ${result.status}): ${msg}`);
  }
  return result.stdout;
}

/** Run wrangler, returning true if exit 0, false if non-zero (no throw). */
export function wranglerOk(...args: string[]): boolean {
  const result = spawnSync("wrangler", args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });
  return result.status === 0;
}

/** Check whether a slug is free (no object exists at that key). */
export function slugIsFree(bucket: string, slug: string): boolean {
  // `wrangler r2 object get --pipe --remote` exits non-zero when the object doesn't exist.
  return !wranglerOk("r2", "object", "get", `${bucket}/${slug}`, "--pipe", "--remote");
}

/** Generate a free slug, retrying on collision. */
export function freeSlug(bucket: string, length: number = SLUG_LENGTH, maxTries = 10): string {
  for (let i = 0; i < maxTries; i++) {
    const slug = generateSlug(length);
    if (slugIsFree(bucket, slug)) return slug;
  }
  throw new Error(`Could not find a free slug after ${maxTries} tries`);
}

/** Ensure the R2 bucket exists, creating it if missing. */
export function ensureBucket(bucket: string, location = "enam"): void {
  if (wranglerOk("r2", "bucket", "info", bucket)) return;
  wrangler("r2", "bucket", "create", bucket, `--location=${location}`);
}

/** Read the Cloudflare API token: env var first, then wrangler's OAuth token file. */
export function resolveApiToken(): string {
  const envToken = process.env.CLOUDFLARE_API_TOKEN;
  if (envToken) return envToken;

  const candidates = [
    join(homedir(), ".config/.wrangler/config/default.toml"),
    join(homedir(), ".wrangler/config/default.toml"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const contents = readFileSync(path, "utf-8");
    const match = /^oauth_token\s*=\s*"([^"]+)"/m.exec(contents);
    if (match) return match[1]!;
  }
  throw new Error(
    "No Cloudflare API token found. Set CLOUDFLARE_API_TOKEN or run `wrangler login`.",
  );
}

/** Resolve the zone id for a parent domain via the Cloudflare API. */
export function resolveZoneId(parentDomain: string): string {
  const token = resolveApiToken();
  const url = `https://api.cloudflare.com/client/v4/zones?name=${parentDomain}`;
  const result = spawnSync("curl", ["-s", url, "-H", `Authorization: Bearer ${token}`], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to query Cloudflare API for zone ${parentDomain}`);
  }
  const data = JSON.parse(result.stdout) as {
    success: boolean;
    errors: { message: string }[];
    result: { id: string; name: string }[] | null;
  };
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  const zone = data.result?.[0];
  if (!zone) {
    throw new Error(`No zone found for ${parentDomain}. Is it on this Cloudflare account?`);
  }
  return zone.id;
}

/** Ensure the custom domain is attached to the bucket. */
export function ensureCustomDomain(bucket: string, domain: string, parentDomain: string): void {
  const listed = wrangler("r2", "bucket", "domain", "list", bucket);
  if (listed.includes(domain)) return;
  const zoneId = resolveZoneId(parentDomain);
  wrangler("r2", "bucket", "domain", "add", bucket, `--domain=${domain}`, `--zone-id=${zoneId}`);
}

/** Upload a file to R2 with text/html content type. */
export function upload(bucket: string, slug: string, filePath: string): void {
  wrangler(
    "r2",
    "object",
    "put",
    `${bucket}/${slug}`,
    `--file=${filePath}`,
    "--content-type=text/html; charset=utf-8",
    "--remote",
  );
}

/** One-command upload: ensure infra, pick slug, upload, return the public URL. */
export async function host(filePath: string, options: UploadOptions = {}): Promise<string> {
  const bucket = options.bucket ?? DEFAULT_BUCKET;
  const domain = options.domain ?? DEFAULT_DOMAIN;
  const parentDomain = domain.split(".").slice(-2).join(".");

  ensureBucket(bucket);
  ensureCustomDomain(bucket, domain, parentDomain);

  const slug = options.slug ?? freeSlug(bucket, options.slugLength ?? SLUG_LENGTH);
  if (!slugIsFree(bucket, slug)) {
    throw new Error(`Slug "${slug}" is already taken. Choose another with --name.`);
  }
  upload(bucket, slug, filePath);
  return `https://${domain}/${slug}`;
}

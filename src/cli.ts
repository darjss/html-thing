#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { host, type UploadOptions } from "./index.ts";

function printHelp(): void {
  console.log(`html-thing — one-command HTML hosting on Cloudflare R2

Usage:
  html-thing <file.html>              Upload and get a public URL
  html-thing <file.html> --name foo   Use a custom slug
  html-thing <file.html> --bucket x   Use a different R2 bucket
  html-thing <file.html> --domain x   Use a different custom domain

The file is served at https://html.darjs.dev/<slug> with content-type text/html.
Requires wrangler authenticated (\`wrangler login\`).`);
}

function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { file: string; options: UploadOptions } | "help" {
  const positional: string[] = [];
  const options: UploadOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") return "help";

    const flagValue = (flag: string): string => {
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
      const next = argv[++i];
      if (!next) fail(`${arg} requires a value`);
      return next;
    };

    if (arg === "--name" || arg.startsWith("--name=")) {
      options.slug = flagValue("--name");
      continue;
    }
    if (arg === "--bucket" || arg.startsWith("--bucket=")) {
      options.bucket = flagValue("--bucket");
      continue;
    }
    if (arg === "--domain" || arg.startsWith("--domain=")) {
      options.domain = flagValue("--domain");
      continue;
    }
    positional.push(arg);
  }
  if (positional.length === 0) return "help";
  if (positional.length > 1) fail(`expected exactly one file, got ${positional.length}`);
  return { file: positional[0]!, options };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === "help") {
    printHelp();
    return;
  }
  const filePath = resolve(parsed.file);
  if (!existsSync(filePath)) fail(`file not found: ${parsed.file}`);
  try {
    const url = await host(filePath, parsed.options);
    console.log(url);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

void main();

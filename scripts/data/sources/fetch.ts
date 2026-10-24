import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { RAW_DIR } from "../paths.ts";

// One fetched file: where it came from and the hash of the bytes we kept.
export type SourceFile = { path: string; url: string; sha256: string; bytes: number };

export type SourceRecord = {
  id: string;
  site: string;
  pin: { kind: "sha256" | "git"; value: string };
  fetchedAt: string;
  files: SourceFile[];
};

export function sha256(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export async function fetchBytes(url: string, timeoutMs = 120_000): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`GET ${url} failed with status ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function fetchText(url: string, timeoutMs = 120_000): Promise<string> {
  return new TextDecoder().decode(await fetchBytes(url, timeoutMs));
}

// Writes the payload verbatim under data/raw/<relative> and returns its record.
export function writeRaw(relative: string, url: string, body: string): SourceFile {
  const file = path.join(RAW_DIR, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  return { path: `raw/${relative}`, url, sha256: sha256(body), bytes: Buffer.byteLength(body) };
}

export function combinedPin(files: readonly SourceFile[]): string {
  return sha256([...files].sort((a, b) => a.path.localeCompare(b.path)).map((file) => `${file.path} ${file.sha256}`).join("\n"));
}

// Writes binary bytes verbatim under data/raw/<relative> (an image) and returns its record.
export function writeRawBytes(relative: string, url: string, body: Uint8Array): SourceFile {
  const file = path.join(RAW_DIR, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body);
  return { path: `raw/${relative}`, url, sha256: sha256(body), bytes: body.byteLength };
}

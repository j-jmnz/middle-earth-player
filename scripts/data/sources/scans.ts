import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { SCAN_CACHE_DIR } from "../paths.ts";
import { scanTargets } from "../printed/scope.ts";
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, sha256, type SourceFile, type SourceRecord } from "./fetch.ts";

// Hall of Beorn serves some scans as PNG under a .jpg name. The cache file takes the extension of the bytes.
export function extensionOf(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  return null;
}

// Width of a JPEG or PNG, from its header. Some Hall of Beorn scans are 207 px thumbnails, too small to read card text from.
export function widthOf(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (extensionOf(bytes) === "png") return view.getUint32(16);
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return 0;
    const marker = bytes[at + 1] ?? 0;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return view.getUint16(at + 7);
    at += 2 + view.getUint16(at + 2);
  }
  return 0;
}

const MIN_WIDTH = 400;

// Card scans stay out of git. They are fetched into .cache/scans/<code>.<side>.<jpg|png> and pinned by sha256 in
// data/sources.json, which is what the printed-text ledger names.
export async function syncScans(log: Log = createLog("scans")): Promise<SourceRecord> {
  mkdirSync(SCAN_CACHE_DIR, { recursive: true });
  const files: SourceFile[] = [];
  const targets = scanTargets();
  log.info(`${targets.length} card sides to fetch into ${SCAN_CACHE_DIR}`);
  const tick = log.progress(targets.length, "scan");
  let fallbacks = 0;
  for (const target of targets) {
    let fetched: { url: string; bytes: Uint8Array } | null = null;
    const failures: string[] = [];
    for (const url of target.urls) {
      try {
        const body = await fetchBytes(url, 60_000, log);
        if (extensionOf(body) === null) throw new Error("not a JPEG or PNG");
        if (widthOf(body) < MIN_WIDTH) throw new Error(`too small to read (${widthOf(body)} px wide)`);
        fetched = { url, bytes: body };
        break;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${url}: ${reason}`);
        log.debug(`${target.code}.${target.side}: skipped ${url}: ${reason}`);
      }
    }
    if (!fetched) throw new Error(`No scan for ${target.code}.${target.side}:\n  ${failures.join("\n  ")}`);
    if (failures.length > 0) fallbacks += 1;
    const extension = extensionOf(fetched.bytes) ?? "jpg";
    writeFileSync(path.join(SCAN_CACHE_DIR, `${target.code}.${target.side}.${extension}`), fetched.bytes);
    files.push({ path: `scans/${target.code}.${target.side}.${extension}`, url: fetched.url, sha256: sha256(fetched.bytes), bytes: fetched.bytes.length });
    tick(`${target.code}.${target.side} ${widthOf(fetched.bytes)} px, ${bytes(fetched.bytes.length)}${failures.length > 0 ? ` (after ${failures.length} unusable URL${failures.length === 1 ? "" : "s"})` : ""}`);
  }
  if (fallbacks > 0) log.info(`${fallbacks} side${fallbacks === 1 ? "" : "s"} came from a fallback URL (--verbose lists the skipped ones)`);
  return { id: "scans", site: "https://hallofbeorn.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}

import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA_DIR = path.join(ROOT, "data");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const PDF_CACHE_DIR = path.join(ROOT, ".cache", "pdf");
export const SCAN_CACHE_DIR = path.join(ROOT, ".cache", "scans");
export const PICTURE_CACHE_DIR = path.join(ROOT, ".cache", "pictures");
// Not under a dot directory: iOS copies a bundled asset into the app at its project path, and a hidden `.cache` folder there
// left the release IPA without its booklets (Android flattens the path into a resource name, so it was not affected).
export const BOOKLET_PACK_DIR = path.join(ROOT, "assets", "booklets");
// The sound effects cut from the player's own game files (scripts/build/pack-sounds.ts), and where the bundle takes them from.
export const SOUND_CACHE_DIR = path.join(ROOT, ".cache", "audio", "sfx");
export const SOUND_PACK_DIR = path.join(ROOT, "assets", "sounds");

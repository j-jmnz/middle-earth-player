import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA_DIR = path.join(ROOT, "data");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const PDF_CACHE_DIR = path.join(ROOT, ".cache", "pdf");
export const SCAN_CACHE_DIR = path.join(ROOT, ".cache", "scans");
export const BOOKLET_CACHE_DIR = path.join(ROOT, ".cache", "booklets");

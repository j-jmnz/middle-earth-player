export const RINGSDB_ORIGIN = "https://ringsdb.com";
export const DOWNLOAD_CONCURRENCY = 4;
export const SERVICE_UNAVAILABLE_RETRIES = 3;
export const IMAGE_DIRECTORY = "images";
export const PAUSE_STATE_FILE = "pause-state.json";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export type ImageMedia = {
  mediaType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  width: number;
  height: number;
};

export type ImageRecord = {
  code: string;
  path: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  mediaType: string | null;
  sha256: string | null;
};

export type DownloadPauseEntry = {
  code: string;
  url: string;
  fileUri: string;
  isDirectory: boolean;
  headers?: Record<string, string>;
  resumeData?: string;
};

export type ImageDownloadRequest = {
  code: string;
  imagesrc: string;
  first?: boolean;
};

export type ImageQueueStatus = {
  pending: number;
  active: number;
  failures: Readonly<Record<string, string>>;
  pauseEntries: number;
};

export function ringsdbImageUrl(imagesrc: string): string | null {
  if (!imagesrc.startsWith("/") || imagesrc.startsWith("//")) return null;
  if (imagesrc.includes("..") || imagesrc.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(imagesrc, RINGSDB_ORIGIN);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  if (url.hostname !== "ringsdb.com") return null;
  if (!url.pathname.startsWith("/") || url.pathname.includes("..")) return null;
  return url.toString();
}

export function retryDelayMs(attempt: number): number {
  return 250 * (attempt + 1);
}

export function statusFromDownloadError(error: unknown): number | null {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const match = /(?:HTTP|status):?\s+(\d{3})\b/i.exec(message);
  if (!match?.[1]) return null;
  const status = Number(match[1]);
  return Number.isInteger(status) ? status : null;
}

export async function withDownloadRetry<T>(
  run: () => Promise<T>,
  delay: (ms: number) => Promise<void>,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (error: unknown) {
      const status = statusFromDownloadError(error);
      if (status !== 503 || attempt >= SERVICE_UNAVAILABLE_RETRIES) throw error;
      await delay(retryDelayMs(attempt));
      attempt += 1;
    }
  }
}

export function createDownloadPump(concurrency: number) {
  if (concurrency < 1) {
    throw new Error("Download concurrency must be at least 1");
  }
  let active = 0;
  const waiting: (() => void)[] = [];

  function acquire(): Promise<void> {
    if (active < concurrency) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      waiting.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  function release(): void {
    active -= 1;
    const next = waiting.shift();
    if (next) next();
  }

  return {
    get active(): number {
      return active;
    },
    get waiting(): number {
      return waiting.length;
    },
    async run<T>(work: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await work();
      } finally {
        release();
      }
    },
  };
}

export function sniffImage(bytes: Uint8Array): ImageMedia | null {
  const png = pngSize(bytes);
  if (png) return { mediaType: "image/png", extension: "png", ...png };
  const jpeg = jpegSize(bytes);
  if (jpeg) return { mediaType: "image/jpeg", extension: "jpg", ...jpeg };
  return null;
}

export function storedFileName(code: string, bytes: Uint8Array): (ImageMedia & { name: string }) | null {
  const media = sniffImage(bytes);
  if (!media) return null;
  return { ...media, name: `${code}.${media.extension}` };
}

export function shouldReplaceImage(
  storedSha256: string | null | undefined,
  nextSha256: string | null | undefined,
): boolean {
  if (!storedSha256 || !nextSha256) return false;
  return storedSha256 !== nextSha256;
}

export function commitImageRecord(
  existing: ImageRecord | null,
  next: ImageRecord,
): { record: ImageRecord; deletePaths: string[] } {
  if (!existing) return { record: next, deletePaths: [] };
  if (!shouldReplaceImage(existing.sha256, next.sha256)) {
    const deletePaths: string[] = [];
    if (
      existing.sha256 &&
      next.sha256 &&
      existing.sha256 === next.sha256 &&
      existing.path &&
      next.path &&
      existing.path !== next.path
    ) {
      deletePaths.push(next.path);
    }
    return { record: existing, deletePaths };
  }
  const deletePaths = existing.path && next.path && existing.path !== next.path ? [existing.path] : [];
  return { record: next, deletePaths };
}

export function pauseEntriesWithout(
  entries: readonly DownloadPauseEntry[],
  code: string,
): DownloadPauseEntry[] {
  return entries.filter((entry) => entry.code !== code);
}

export function shouldResumeFromEntry(entry: DownloadPauseEntry): boolean {
  return typeof entry.resumeData === "string" && entry.resumeData.length > 0;
}

export function requeuePausedDownload(pausing: boolean, savedInPauseFile: boolean): boolean {
  return !pausing && !savedInPauseFile;
}

export function planForegroundDownloads(
  pending: readonly { code: string; url: string }[],
  entries: readonly DownloadPauseEntry[],
  busy: ReadonlySet<string>,
): { resume: DownloadPauseEntry[]; pending: { code: string; url: string }[] } {
  const resumeCodes = new Set(
    entries.filter((entry) => shouldResumeFromEntry(entry)).map((entry) => entry.code),
  );
  const waiting = pending.filter((job) => !resumeCodes.has(job.code) && !busy.has(job.code));
  const resume: DownloadPauseEntry[] = [];
  for (const entry of entries) {
    if (busy.has(entry.code)) continue;
    if (!shouldResumeFromEntry(entry)) {
      if (!waiting.some((job) => job.code === entry.code)) waiting.unshift({ code: entry.code, url: entry.url });
      continue;
    }
    resume.push(entry);
  }
  return { resume, pending: waiting };
}

export type ResolvedCardImage =
  | { kind: "file"; uri: string; width: number; height: number; download: false }
  | { kind: "asset"; moduleId: number; width: number; height: number; download: false }
  | { kind: "text"; download: boolean };

export function resolveCardImage(input: {
  cached: { uri: string; width: number; height: number } | null;
  imagesrc: string | null;
  bundled: { moduleId: number; width: number; height: number } | null;
}): ResolvedCardImage {
  if (input.cached) {
    return { kind: "file", ...input.cached, download: false };
  }
  if (input.imagesrc == null || input.imagesrc.length === 0) {
    if (input.bundled) return { kind: "asset", ...input.bundled, download: false };
    return { kind: "text", download: false };
  }
  if (ringsdbImageUrl(input.imagesrc) == null) return { kind: "text", download: false };
  return { kind: "text", download: true };
}

export function imageLayoutSize(
  pixelWidth: number,
  pixelHeight: number,
  maxWidth: number,
): { width: number; height: number } {
  const width = Math.min(pixelWidth, Math.max(0, maxWidth));
  if (pixelWidth <= 0) return { width: 0, height: 0 };
  return { width, height: Math.round((pixelHeight * width) / pixelWidth) };
}

export function isRemoteImageUri(uri: string): boolean {
  return uri.startsWith("https://") || uri.startsWith("http://");
}

export function shownCardImage(input: {
  cached: { uri: string; width: number; height: number } | null;
  imagesrc: string | null;
  bundled: { moduleId: number; width: number; height: number } | null;
}): { resolved: ResolvedCardImage; source: { uri: string } | number | null } {
  const resolved = resolveCardImage(input);
  return { resolved, source: displaySource(resolved) };
}

export function displaySource(resolved: ResolvedCardImage): { uri: string } | number | null {
  if (resolved.kind === "file") {
    if (isRemoteImageUri(resolved.uri)) return null;
    return { uri: resolved.uri };
  }
  if (resolved.kind === "asset") return resolved.moduleId;
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) return null;
  }
  const type = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0);
  if (type !== "IHDR") return null;
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset] ?? 0;
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;
    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      if (offset + 6 >= bytes.length) return null;
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }
    offset += segmentLength;
  }
  return null;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

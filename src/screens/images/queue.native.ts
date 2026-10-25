import { AppState } from "react-native";
import { eq } from "drizzle-orm";
import { Directory, DownloadTask, File, Paths } from "expo-file-system";

import { excludeImageDirectoryFromBackup } from "image-backup-exclusion";

import type { AppDatabases } from "../open-databases";
import { imageFiles } from "../user-schema";
import {
  DOWNLOAD_CONCURRENCY,
  IMAGE_DIRECTORY,
  PAUSE_STATE_FILE,
  cardImageUrl,
  commitImageRecord,
  createDownloadPump,
  isRemoteImageUri,
  pauseEntriesWithout,
  planForegroundDownloads,
  requeuePausedDownload,
  shouldResumeFromEntry,
  sniffImage,
  withDownloadRetry,
  type DownloadPauseEntry,
  type ImageDownloadRequest,
  type ImageQueueStatus,
  type ImageRecord,
} from "./policy";
import { scanAssets } from "./scan-map";
import { cachedImage, publishCachedImage } from "./store";

type UserDatabase = AppDatabases["user"];

const pump = createDownloadPump(DOWNLOAD_CONCURRENCY);
const pending: { code: string; url: string }[] = [];
const queued = new Set<string>();
const activeTasks = new Map<string, DownloadTask>();
const activeUrls = new Map<string, string>();
const resuming = new Set<string>();
let userDb: UserDatabase | null = null;
let imageDirectory: Directory | null = null;
let started = false;
let pausing = false;
let appStateBound = false;
const queueListeners = new Set<() => void>();
let failureSentences: Record<string, string> = {};
let queueSnapshot: ImageQueueStatus = {
  pending: 0,
  active: 0,
  failures: failureSentences,
  pauseEntries: 0,
};

function captureQueueStatus(): ImageQueueStatus {
  return {
    pending: pending.length + pump.waiting,
    active: activeTasks.size,
    failures: failureSentences,
    pauseEntries: readPauseEntries().length,
  };
}

function publishQueueStatus(): void {
  const next = captureQueueStatus();
  if (
    queueSnapshot.pending === next.pending &&
    queueSnapshot.active === next.active &&
    queueSnapshot.pauseEntries === next.pauseEntries &&
    queueSnapshot.failures === next.failures
  ) {
    return;
  }
  queueSnapshot = next;
  for (const listener of queueListeners) {
    try {
      listener();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error : new Error("Image queue listener failed");
      console.warn(reason.message);
    }
  }
}

function recordFailure(code: string, sentence: string): void {
  if (failureSentences[code] === sentence) return;
  failureSentences = { ...failureSentences, [code]: sentence };
  publishQueueStatus();
}

function clearFailure(code: string): void {
  if (!(code in failureSentences)) return;
  const next = { ...failureSentences };
  delete next[code];
  failureSentences = next;
  publishQueueStatus();
}

export function imageQueueStatus(): ImageQueueStatus {
  return queueSnapshot;
}

export function readImageQueueStatus(): ImageQueueStatus {
  publishQueueStatus();
  return queueSnapshot;
}

export function subscribeImageQueue(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function enqueueImageDownloads(jobs: readonly ImageDownloadRequest[]): void {
  const front: { code: string; url: string }[] = [];
  const back: { code: string; url: string }[] = [];
  for (const job of jobs) {
    // A scan the release build bundled (scripts/pack-scans.ts) is not downloaded again.
    if (queued.has(job.code) || cachedImage(job.code) || scanAssets[job.code]) continue;
    const url = cardImageUrl(job.imagesrc);
    if (!url) continue;
    queued.add(job.code);
    const item = { code: job.code, url };
    if (job.first) front.push(item);
    else back.push(item);
  }
  if (front.length > 0) pending.unshift(...front);
  pending.push(...back);
  if (started && !pausing) void pumpPending();
  publishQueueStatus();
}

export function startImageDownloads(user: UserDatabase): void {
  if (started) return;
  started = true;
  userDb = user;
  try {
    const images = new Directory(Paths.document, IMAGE_DIRECTORY);
    if (!images.exists) images.create();
    imageDirectory = images;
    try {
      excludeImageDirectoryFromBackup(images.uri);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error : new Error("Image backup exclusion is unavailable");
      console.warn(reason.message);
    }
    rememberStoredRows(user);
    for (const entry of readPauseEntries()) {
      if (cachedImage(entry.code)) continue;
      if (shouldResumeFromEntry(entry)) void runResume(entry);
      else pending.unshift({ code: entry.code, url: entry.url });
      queued.add(entry.code);
    }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error : new Error("Image downloads did not start");
    console.warn(reason.message);
  }
  bindAppState();
  void pumpPending();
  publishQueueStatus();
}

function bindAppState(): void {
  if (appStateBound) return;
  appStateBound = true;
  AppState.addEventListener("change", (state) => {
    if (state === "background") {
      void pauseActive();
      return;
    }
    if (state === "active") void resumeAfterForeground();
  });
}

function rememberStoredRows(user: UserDatabase): void {
  const rows = user.select().from(imageFiles).all();
  for (const row of rows) {
    if (!row.path || row.width == null || row.height == null || isRemoteImageUri(row.path)) continue;
    publishCachedImage(row.code, { uri: row.path, width: row.width, height: row.height });
    queued.add(row.code);
  }
}

function pumpPending(): void {
  if (pausing) return;
  while (pending.length > 0) {
    const job = pending.shift();
    if (!job) break;
    void pump.run(() => runFresh(job)).catch((error: unknown) => {
      const reason = error instanceof Error ? error : new Error("Image download failed");
      console.warn(reason.message);
    });
  }
  publishQueueStatus();
}

async function runFresh(job: { code: string; url: string }): Promise<void> {
  const images = imageDirectory;
  if (!images) return;
  clearFailure(job.code);
  if (cachedImage(job.code)) return;
  if (activeTasks.has(job.code)) return;
  if (pausing) {
    pending.unshift(job);
    publishQueueStatus();
    return;
  }
  const partial = new File(images, `${job.code}.partial`);
  try {
    await withDownloadRetry(async () => {
      if (pausing) {
        const paused = new Error("paused");
        paused.name = "PausedDownload";
        throw paused;
      }
      if (partial.exists) partial.delete();
      const task = File.createDownloadTask(job.url, partial, { sessionType: "foreground" });
      activeTasks.set(job.code, task);
      activeUrls.set(job.code, job.url);
      publishQueueStatus();
      try {
        const file = await task.downloadAsync();
        if (!file) {
          const paused = new Error("paused");
          paused.name = "PausedDownload";
          throw paused;
        }
        await finishDownload(job.code, file);
      } finally {
        activeTasks.delete(job.code);
        activeUrls.delete(job.code);
        publishQueueStatus();
      }
    }, delay);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "PausedDownload") {
      const saved = readPauseEntries().some((entry) => entry.code === job.code);
      if (requeuePausedDownload(pausing, saved)) pending.unshift(job);
      publishQueueStatus();
      return;
    }
    queued.delete(job.code);
    const reason = error instanceof Error ? error : new Error("Image download failed");
    recordFailure(job.code, reason.message);
    console.warn(`${job.code}: ${reason.message}`);
  }
}

async function runResume(entry: DownloadPauseEntry): Promise<void> {
  if (resuming.has(entry.code) || activeTasks.has(entry.code)) return;
  const resumeData = entry.resumeData;
  if (!resumeData) {
    pending.unshift({ code: entry.code, url: entry.url });
    void pumpPending();
    return;
  }
  resuming.add(entry.code);
  await pump.run(async () => {
    const task = DownloadTask.fromSavable(
      {
        url: entry.url,
        fileUri: entry.fileUri,
        isDirectory: entry.isDirectory,
        headers: entry.headers,
        resumeData,
      },
      { sessionType: "foreground" },
    );
    activeTasks.set(entry.code, task);
    activeUrls.set(entry.code, entry.url);
    publishQueueStatus();
    try {
      const file = await task.resumeAsync();
      if (!file) return;
      await finishDownload(entry.code, file);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error : new Error("Image resume failed");
      recordFailure(entry.code, reason.message);
      console.warn(`${entry.code}: ${reason.message}`);
      writePauseEntries(pauseEntriesWithout(readPauseEntries(), entry.code));
      activeTasks.delete(entry.code);
      activeUrls.delete(entry.code);
      resuming.delete(entry.code);
      if (!pending.some((job) => job.code === entry.code)) {
        pending.unshift({ code: entry.code, url: entry.url });
      }
      void pumpPending();
    } finally {
      activeTasks.delete(entry.code);
      activeUrls.delete(entry.code);
      publishQueueStatus();
    }
  }).finally(() => {
    resuming.delete(entry.code);
  });
}

async function finishDownload(code: string, file: File): Promise<void> {
  const images = imageDirectory;
  if (!images) return;
  const bytes = await file.bytes();
  const media = sniffImage(bytes);
  if (!media) {
    if (file.exists) file.delete();
    writePauseEntries(pauseEntriesWithout(readPauseEntries(), code));
    recordFailure(code, "Image is not a JPEG or PNG.");
    return;
  }
  clearFailure(code);
  const sha256 = await file.digest("SHA-256");
  const finalFile = new File(images, `${code}.${media.extension}`);
  const next: ImageRecord = {
    code,
    path: finalFile.uri,
    width: media.width,
    height: media.height,
    byteSize: bytes.length,
    mediaType: media.mediaType,
    sha256,
  };
  const existing = readRecord(code);
  const decision = commitImageRecord(existing, next);
  if (existing && decision.record === existing) {
    if (file.exists && file.uri !== existing.path) file.delete();
    for (const path of decision.deletePaths) {
      if (path === existing.path) continue;
      deleteFile(path);
    }
    if (existing.path && existing.width != null && existing.height != null && !isRemoteImageUri(existing.path)) {
      publishCachedImage(code, { uri: existing.path, width: existing.width, height: existing.height });
    }
    writePauseEntries(pauseEntriesWithout(readPauseEntries(), code));
    queued.add(code);
    return;
  }
  if (finalFile.exists && finalFile.uri !== file.uri) finalFile.delete();
  if (file.uri !== finalFile.uri) file.rename(`${code}.${media.extension}`);
  for (const path of decision.deletePaths) {
    if (path === file.uri) continue;
    deleteFile(path);
  }
  if (isRemoteImageUri(file.uri)) {
    if (file.exists) file.delete();
    return;
  }
  const stored: ImageRecord = { ...decision.record, path: file.uri };
  writeRecord(stored);
  if (stored.path && stored.width != null && stored.height != null) {
    publishCachedImage(code, { uri: stored.path, width: stored.width, height: stored.height });
  }
  writePauseEntries(pauseEntriesWithout(readPauseEntries(), code));
  queued.add(code);
}

async function pauseActive(): Promise<void> {
  pausing = true;
  const tasks = [...activeTasks.entries()];
  const entries = readPauseEntries().filter((entry) => !activeTasks.has(entry.code));
  const failed: { code: string; url: string }[] = [];
  for (const [code, task] of tasks) {
    try {
      await task.pauseAsync();
      const saved = task.savable();
      entries.push({
        code,
        url: saved.url,
        fileUri: saved.fileUri,
        isDirectory: saved.isDirectory,
        headers: saved.headers,
        resumeData: saved.resumeData,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error : new Error("Image download did not pause");
      console.warn(`${code}: ${reason.message}`);
      const url = activeUrls.get(code);
      if (url) failed.push({ code, url });
    }
  }
  writePauseEntries(entries);
  for (const job of failed) {
    if (entries.some((entry) => entry.code === job.code)) continue;
    if (!pending.some((item) => item.code === job.code)) pending.unshift(job);
  }
  publishQueueStatus();
}

function resumeAfterForeground(): void {
  pausing = false;
  const busy = new Set<string>();
  for (const code of activeTasks.keys()) {
    if (cachedImage(code)) continue;
    busy.add(code);
  }
  for (const code of resuming) busy.add(code);
  for (const entry of readPauseEntries()) {
    if (cachedImage(entry.code)) continue;
    queued.add(entry.code);
  }
  const plan = planForegroundDownloads(pending, readPauseEntries(), busy);
  pending.splice(0, pending.length, ...plan.pending);
  for (const entry of plan.resume) void runResume(entry);
  pumpPending();
  publishQueueStatus();
}

function readRecord(code: string): ImageRecord | null {
  if (!userDb) return null;
  const row = userDb.select().from(imageFiles).where(eq(imageFiles.code, code)).get();
  if (!row) return null;
  return {
    code: row.code,
    path: row.path,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    mediaType: row.mediaType,
    sha256: row.sha256,
  };
}

function writeRecord(record: ImageRecord): void {
  if (!userDb || !record.path || record.width == null || record.height == null) return;
  userDb
    .insert(imageFiles)
    .values({
      code: record.code,
      path: record.path,
      width: record.width,
      height: record.height,
      byteSize: record.byteSize,
      mediaType: record.mediaType,
      sha256: record.sha256,
    })
    .onConflictDoUpdate({
      target: imageFiles.code,
      set: {
        path: record.path,
        width: record.width,
        height: record.height,
        byteSize: record.byteSize,
        mediaType: record.mediaType,
        sha256: record.sha256,
      },
    })
    .run();
}

function deleteFile(path: string): void {
  const file = new File(path);
  if (file.exists) file.delete();
}

function pauseStateFile(): File | null {
  if (!imageDirectory) return null;
  return new File(imageDirectory, PAUSE_STATE_FILE);
}

function readPauseEntries(): DownloadPauseEntry[] {
  const file = pauseStateFile();
  if (!file?.exists) return [];
  try {
    const parsed: unknown = JSON.parse(file.textSync());
    if (!Array.isArray(parsed)) return [];
    const entries: DownloadPauseEntry[] = [];
    for (const value of parsed) {
      const entry = pauseEntry(value);
      if (entry) entries.push(entry);
    }
    return entries;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error : new Error("Pause state could not be read");
    console.warn(reason.message);
    return [];
  }
}

function writePauseEntries(entries: readonly DownloadPauseEntry[]): void {
  const file = pauseStateFile();
  if (!file) return;
  if (!file.exists) file.create();
  file.writeSync(JSON.stringify(entries));
  publishQueueStatus();
}

function pauseEntry(value: unknown): DownloadPauseEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.code !== "string" || typeof entry.url !== "string") return null;
  if (typeof entry.fileUri !== "string" || typeof entry.isDirectory !== "boolean") return null;
  const headers = recordOfStrings(entry.headers);
  const resumeData = typeof entry.resumeData === "string" ? entry.resumeData : undefined;
  return {
    code: entry.code,
    url: entry.url,
    fileUri: entry.fileUri,
    isDirectory: entry.isDirectory,
    headers,
    resumeData,
  };
}

function recordOfStrings(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const headers: Record<string, string> = {};
  for (const [key, header] of Object.entries(value)) {
    if (typeof header !== "string") return undefined;
    headers[key] = header;
  }
  return headers;
}

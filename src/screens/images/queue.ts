import type { ImageDownloadRequest, ImageQueueStatus } from "./policy";

const emptyQueueStatus: ImageQueueStatus = {
  pending: 0,
  active: 0,
  failures: {},
  pauseEntries: 0,
};

export function startImageDownloads(_user: unknown): void {}

export function enqueueImageDownloads(_jobs: readonly ImageDownloadRequest[]): void {}

export function imageQueueStatus(): ImageQueueStatus {
  return emptyQueueStatus;
}

export function readImageQueueStatus(): ImageQueueStatus {
  return emptyQueueStatus;
}

export function subscribeImageQueue(_listener: () => void): () => void {
  return () => {};
}

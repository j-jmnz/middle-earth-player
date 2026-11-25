// A copy of expo-sqlite's web/WorkerChannel.ts, served in its place on the web platform by metro.config.js (the phone never bundles it). The one change is the wait in
// `invokeWorkerSync`: a wall-clock deadline (sync-wait.ts) instead of a spin count, reported to the web app's test meter when it shows. scripts/checks/web-copies.test.ts fails when expo-sqlite's file changes, so the copy follows it.

import { Deferred } from '../../../../node_modules/expo-sqlite/web/Deferred';
import { serialize, deserialize } from '../../../../node_modules/expo-sqlite/web/SyncSerializer';
import { SYNC_CLOCK_EVERY, noteSyncWait, syncWaitExpired } from './sync-wait';
import {
  type SQLiteWorkerMessageType,
  type MessageTypeMap,
  type ResultType,
  type ResultTypeMap,
} from '../../../../node_modules/expo-sqlite/web/web.types';

let messageId = 0;
const deferredMap = new Map<number, Deferred>();
const PENDING = 1;
const RESOLVED = 2;

let hasWarnedSync = false;

/**
 * For worker to send result to the main thread.
 */
export function sendWorkerResult({
  id,
  result,
  error,
  syncTrait,
}: {
  id: number;
  result: ResultType | null;
  error: Error | null;
  syncTrait?: {
    lockBuffer: SharedArrayBuffer;
    resultBuffer: SharedArrayBuffer;
  };
}) {
  // Send the message as a string. An Error doesn't survive JSON, and `String(error)` keeps it non-empty.
  const errorMessage = error != null ? error.message || String(error) : null;
  if (syncTrait) {
    const { lockBuffer, resultBuffer } = syncTrait;
    const lock = new Int32Array(lockBuffer);
    let resultBytes = new TextEncoder().encode(
      errorMessage != null ? serialize({ error: errorMessage }) : serialize({ result })
    );
    if (resultBytes.length + 4 > resultBuffer.byteLength) {
      resultBytes = new TextEncoder().encode(
        serialize({
          error: `The synchronous result is ${resultBytes.length} bytes, which is more than the ${resultBuffer.byteLength - 4} bytes that synchronous calls can return on web. Use the async API for large results.`,
        })
      );
    }
    new Uint32Array(resultBuffer, 0, 1)[0] = resultBytes.length;
    new Uint8Array(resultBuffer).set(resultBytes, 4);
    Atomics.store(lock, 0, RESOLVED);
  } else {
    if (error != null) {
      self.postMessage({ id, error: errorMessage });
    } else {
      self.postMessage({ id, result });
    }
  }
}

/**
 * For main thread to handle worker messages.
 */
export function workerMessageHandler(event: MessageEvent) {
  const { id, result, error, isSync } = event.data;
  if (!isSync) {
    const deferred = deferredMap.get(id);
    if (deferred) {
      if (error) {
        deferred.reject(new Error(error));
      } else {
        deferred.resolve(result);
      }
      deferredMap.delete(id);
    }
  }
}

/**
 * For main thread to invoke worker function asynchronously.
 */
export async function invokeWorkerAsync<T extends SQLiteWorkerMessageType & keyof ResultTypeMap>(
  worker: Worker,
  type: T,
  data: MessageTypeMap[T]['data']
): Promise<ResultTypeMap[T]> {
  const id = messageId++;
  const deferred = new Deferred<ResultTypeMap[T]>();
  deferredMap.set(id, deferred);
  worker.postMessage({ type, id, data, isSync: false });
  return deferred.getPromise();
}

/**
 * For main thread to invoke worker function synchronously.
 */
export function invokeWorkerSync<T extends SQLiteWorkerMessageType & keyof ResultTypeMap>(
  worker: Worker,
  type: T,
  data: MessageTypeMap[T]['data']
): ResultTypeMap[T] {
  if (__DEV__ && !hasWarnedSync) {
    console.warn(
      'Using synchronous SQLite operations can cause significant performance impact. Consider using async operations instead.'
    );
    hasWarnedSync = true;
  }

  const id = messageId++;
  const lockBuffer = new SharedArrayBuffer(4);
  const lock = new Int32Array(lockBuffer);
  const resultBuffer = new SharedArrayBuffer(1024 * 1024);
  const resultArray = new Uint8Array(resultBuffer);

  Atomics.store(lock, 0, PENDING);
  worker.postMessage({
    type,
    id,
    data,
    isSync: true,
    lockBuffer,
    resultBuffer,
  });

  const startedAt = performance.now();
  let i = 0;
  const useAtomicsPause = typeof Atomics.pause === 'function';
  while (Atomics.load(lock, 0) === PENDING) {
    ++i;

    if (i % SYNC_CLOCK_EVERY === 0 && syncWaitExpired(startedAt, performance.now())) {
      throw new Error('Sync operation timeout');
    }
    if (useAtomicsPause) {
      Atomics.pause();
    }
  }
  noteSyncWait(startedAt, performance.now());

  const length = new Uint32Array(resultArray.buffer, 0, 1)[0];
  const resultCopy = new Uint8Array(length);
  resultCopy.set(new Uint8Array(resultArray.buffer, 4, length));
  const resultJson = new TextDecoder().decode(resultCopy);
  const { result, error } = deserialize<{ result: ResultTypeMap[T]; error?: string }>(resultJson);
  if (error) throw new Error(error);
  return result;
}

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  cardImageUrl,
  commitImageRecord,
  createDownloadPump,
  displaySource,
  imageLayoutSize,
  resolveCardImage,
  retryDelayMs,
  shouldReplaceImage,
  planForegroundDownloads,
  requeuePausedDownload,
  shouldResumeFromEntry,
  shownCardImage,
  sniffImage,
  storedFileName,
  withDownloadRetry,
  type ImageRecord,
} from "./policy.ts";

function jpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes[11] = 13;
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

const stored: ImageRecord = {
  code: "141001",
  path: "file:///images/141001.jpg",
  width: 423,
  height: 600,
  byteSize: 148338,
  mediaType: "image/jpeg",
  sha256: "same",
};

describe("image policy", () => {
  it("stores a .png URL whose bytes are JPEG as JPEG, with the SOF size", () => {
    const url = cardImageUrl("/bundles/cards/141001.png");
    expect(url).toBe("https://ringsdb.com/bundles/cards/141001.png");
    const storedFile = storedFileName("141001", jpeg(423, 600));
    expect(storedFile).toEqual({
      mediaType: "image/jpeg",
      extension: "jpg",
      width: 423,
      height: 600,
      name: "141001.jpg",
    });
  });

  it("reads a PNG IHDR and rejects a non-site path and a DragnCards host", () => {
    expect(sniffImage(png(429, 600))).toEqual({
      mediaType: "image/png",
      extension: "png",
      width: 429,
      height: 600,
    });
    expect(cardImageUrl("bundles/cards/141001.png")).toBeNull();
    expect(cardImageUrl("/../secret.png")).toBeNull();
    expect(cardImageUrl("https://dragncards.com/a.png")).toBeNull();
    expect(cardImageUrl("//dragncards.com/a.png")).toBeNull();
  });

  it("downloads a scan from Hall of Beorn or DragnCards where RingsDB has no picture, and no other host", () => {
    expect(cardImageUrl("https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Fellowship-of-the-Ring/Bag-End.jpg")).toBe(
      "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Fellowship-of-the-Ring/Bag-End.jpg",
    );
    expect(cardImageUrl("https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/Revised-Core-Set/Théodred.jpg")).toBe(
      "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/Revised-Core-Set/Th%C3%A9odred.jpg",
    );
    expect(cardImageUrl("https://dragncards-lotrlcg.s3.amazonaws.com/cards/English/2b38254c-e992-4fb5-89e8-e7f636658ce0.jpg")).toBe(
      "https://dragncards-lotrlcg.s3.amazonaws.com/cards/English/2b38254c-e992-4fb5-89e8-e7f636658ce0.jpg",
    );
    expect(cardImageUrl("http://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/a.jpg")).toBeNull();
    expect(cardImageUrl("https://s3.amazonaws.com/another-bucket/a.jpg")).toBeNull();
    expect(cardImageUrl("https://s3.amazonaws.com/hallofbeorn-resources/../another-bucket/a.jpg")).toBeNull();
    expect(cardImageUrl("https://s3.amazonaws.com/hallofbeorn-resources/a.jpg?x=1")).toBeNull();
    expect(cardImageUrl("https://user@s3.amazonaws.com/hallofbeorn-resources/a.jpg")).toBeNull();
    expect(cardImageUrl("https://s3.amazonaws.com.evil.example/hallofbeorn-resources/a.jpg")).toBeNull();

    const scan = "https://s3.amazonaws.com/hallofbeorn-resources/Images/Cards/The-Fellowship-of-the-Ring/Bag-End.jpg";
    expect(resolveCardImage({ cached: null, imagesrc: scan, bundled: null })).toEqual({ kind: "text", download: true });
    // A release build that bundled the scan shows it and does not download it.
    expect(resolveCardImage({ cached: null, imagesrc: scan, bundled: { moduleId: 7, width: 400, height: 560 } })).toEqual({
      kind: "asset",
      moduleId: 7,
      width: 400,
      height: 560,
      download: false,
    });
  });

  it("retries a 503 three times and does not retry a 404", async () => {
    const delays: number[] = [];
    let failures = 0;
    const downloaded = await withDownloadRetry(async () => {
      failures += 1;
      if (failures <= 3) throw new Error("Unable to download a file: server returned HTTP 503");
      return "file";
    }, async (ms) => {
      delays.push(ms);
    });
    expect(downloaded).toBe("file");
    expect(delays).toEqual([retryDelayMs(0), retryDelayMs(1), retryDelayMs(2)]);

    let misses = 0;
    await expect(
      withDownloadRetry(async () => {
        misses += 1;
        throw new Error("Unable to download a file: response has status 404");
      }, async () => {
        throw new Error("404 must not wait");
      }),
    ).rejects.toThrow(/404/);
    expect(misses).toBe(1);
  });

  it("never runs more than 4 downloads at once", async () => {
    const pump = createDownloadPump(4);
    let inFlight = 0;
    let max = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        pump.run(async () => {
          inFlight += 1;
          max = Math.max(max, inFlight);
          await new Promise((resolve) => {
            setTimeout(resolve, 15);
          });
          inFlight -= 1;
        }),
      ),
    );
    expect(max).toBe(4);
    expect(pump.active).toBe(0);
    expect(pump.waiting).toBe(0);
  });

  it("counts downloads that are waiting for a slot", async () => {
    const pump = createDownloadPump(1);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = pump.run(() => gate);
    await Promise.resolve();
    expect(pump.active).toBe(1);
    const second = pump.run(async () => {});
    expect(pump.waiting).toBe(1);
    release();
    await first;
    await second;
    expect(pump.active).toBe(0);
    expect(pump.waiting).toBe(0);
  });

  it("keeps a file with the same sha256 and deletes one when the hash differs", () => {
    expect(shouldReplaceImage("same", "same")).toBe(false);
    expect(shouldReplaceImage("same", null)).toBe(false);
    expect(shouldReplaceImage(null, "next")).toBe(false);
    expect(shouldReplaceImage("same", "next")).toBe(true);

    const same = commitImageRecord(stored, { ...stored, path: "file:///images/141001-new.jpg", sha256: "same" });
    expect(same.record.path).toBe(stored.path);
    expect(same.deletePaths).toEqual(["file:///images/141001-new.jpg"]);

    const changed = commitImageRecord(stored, { ...stored, path: "file:///images/141001-new.jpg", sha256: "next" });
    expect(changed.record.sha256).toBe("next");
    expect(changed.deletePaths).toEqual([stored.path]);

    const missing = commitImageRecord(stored, { ...stored, path: "file:///images/141001-new.jpg", sha256: null });
    expect(missing.record).toBe(stored);
    expect(missing.deletePaths).toEqual([]);
  });

  it("returns a bundled scan without a download", () => {
    const bundled = resolveCardImage({
      cached: null,
      imagesrc: null,
      bundled: { moduleId: 7, width: 400, height: 560 },
    });
    expect(bundled).toEqual({ kind: "asset", moduleId: 7, width: 400, height: 560, download: false });
    expect(displaySource(bundled)).toBe(7);

    const cached = resolveCardImage({
      cached: { uri: "file:///images/141001.jpg", width: 423, height: 600 },
      imagesrc: "/bundles/cards/141001.png",
      bundled: null,
    });
    expect(cached.download).toBe(false);
    expect(displaySource(cached)).toEqual({ uri: "file:///images/141001.jpg" });

    // A file downloaded before the release bundled a larger picture gives way to the bundled one.
    const both = resolveCardImage({
      cached: { uri: "file:///images/01134.jpg", width: 300, height: 428 },
      imagesrc: "/bundles/cards/01134.png",
      bundled: { moduleId: 9, width: 846, height: 1200 },
    });
    expect(displaySource(both)).toBe(9);

    const pending = resolveCardImage({
      cached: null,
      imagesrc: "/bundles/cards/141001.png",
      bundled: null,
    });
    expect(pending).toEqual({ kind: "text", download: true });
    expect(displaySource(pending)).toBeNull();
    expect(displaySource({ kind: "file", uri: "https://ringsdb.com/a.jpg", width: 1, height: 1, download: false })).toBeNull();
    expect(displaySource({ kind: "file", uri: "https://dragncards.com/a.jpg", width: 1, height: 1, download: false })).toBeNull();
  });

  it("does not upscale a wide layout past the sniffed pixels", () => {
    expect(imageLayoutSize(423, 600, 800)).toEqual({ width: 423, height: 600 });
    expect(imageLayoutSize(423, 600, 300).width).toBe(300);
    expect(shouldResumeFromEntry({
      code: "141001",
      url: "https://ringsdb.com/a.png",
      fileUri: "file:///images/141001.partial",
      isDirectory: false,
    })).toBe(false);
  });

  it("resumes a paused download instead of starting that code again", () => {
    const entry = {
      code: "141001",
      url: "https://ringsdb.com/bundles/cards/141001.png",
      fileUri: "file:///images/141001.partial",
      isDirectory: false,
      resumeData: "opaque",
    };
    const plan = planForegroundDownloads([{ code: "141001", url: entry.url }], [entry], new Set());
    expect(plan.resume).toEqual([entry]);
    expect(plan.pending).toEqual([]);
    expect(requeuePausedDownload(true, false)).toBe(false);
    expect(requeuePausedDownload(false, true)).toBe(false);
    expect(requeuePausedDownload(false, false)).toBe(true);
    const fresh = planForegroundDownloads([], [{ ...entry, resumeData: undefined }], new Set());
    expect(fresh.resume).toEqual([]);
    expect(fresh.pending).toEqual([{ code: "141001", url: entry.url }]);
    expect(shownCardImage({
      cached: { uri: "file:///images/141001.jpg", width: 423, height: 600 },
      imagesrc: "/bundles/cards/141001.png",
      bundled: null,
    }).source).toEqual({ uri: "file:///images/141001.jpg" });
  });

  it("downloads only through File.createDownloadTask", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name === "node_modules" || name === "modules") continue;
          walk(full);
          continue;
        }
        if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
        if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
        const text = readFileSync(full, "utf8");
        if (text.includes("createDownloadTask") || text.includes("createDownloadResumable") || text.includes("fromSavable")) {
          hits.push(path.relative(root, full));
        }
      }
    };
    walk(path.join(root, "src"));
    walk(path.join(root, "scripts"));
    expect(hits).toEqual(["src/screens/images/queue.native.ts"]);
    const queue = readFileSync(path.join(root, "src/screens/images/queue.native.ts"), "utf8");
    expect(queue).toContain("sessionType: \"foreground\"");
    expect(queue).not.toContain("createDownloadResumable");
  });
});

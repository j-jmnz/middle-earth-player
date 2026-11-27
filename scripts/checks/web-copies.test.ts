// A web variant that has to copy a phone file (metro.config.js serves `X.canvaskit.ts(x)` in its place on the web platform) differs from it by the listed edits and nothing
// else, so a change to the phone's file shows up here until the copy follows it (docs/architecture.md, Screens).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

type Edit = readonly [from: string, to: string];

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
// The file from `marker` on, or without its opening `//` comment: each copy has a header of its own.
// With `to`, the part ends after the first `to` that follows (a copy of one block of a longer file).
const body = (text: string, marker?: string, to?: string): string => {
  const start = marker === undefined ? text.search(/^(?!\/\/)/m) : text.indexOf(marker);
  expect(start, `no ${marker} in the file`).toBeGreaterThanOrEqual(0);
  if (to === undefined) return text.slice(start);
  const end = text.indexOf(to, start);
  expect(end, `no ${to} after ${marker}`).toBeGreaterThanOrEqual(0);
  return text.slice(start, end + to.length);
};

const COPIES: readonly { phone: string; web: string; from?: string; to?: string; edits: readonly Edit[] }[] = [
  {
    phone: "src/play/spotlight/use-spotlight.ts",
    web: "src/play/spotlight/use-spotlight.canvaskit.ts",
    edits: [
      ['import { Platform } from "react-native";\n', ""],
      [
        '// The web build lists the table and has no canvas to play a spotlight on.\nconst CANVAS = Platform.OS !== "web";',
        "// A canvas draws the spotlight on every platform (the web's once CanvasKit has loaded, and until then the list table ends each gate: reader-gate.ts).\nconst CANVAS = true;",
      ],
    ],
  },
  {
    // The keys, the focus, the slider's values and the pointer a page needs (the header of volume-slider.canvaskit.tsx).
    phone: "src/ui/sound/volume-slider.tsx",
    web: "src/ui/sound/volume-slider.canvaskit.tsx",
    edits: [
      ["import { stepVolume, volumeAt, volumeWords } from \"./volume.ts\";\n", "import { stepVolume, volumeAt, volumeWords } from \"./volume.ts\";\nimport { volumeKey } from \"../web/volume-keys.ts\";\n"],
      ["            onAccessibilityAction={(event) => onChange(stepVolume(value, event.nativeEvent.actionName === \"increment\"))}\n            style={{ flex: 1, minHeight: touch(s, ROW), justifyContent: \"center\" }}\n", "            onAccessibilityAction={(event) => onChange(stepVolume(value, event.nativeEvent.actionName === \"increment\"))}\n            focusable\n            aria-valuemin={0}\n            aria-valuemax={100}\n            aria-valuenow={Math.round(shown * 100)}\n            aria-valuetext={volumeWords(shown)}\n            onKeyDown={(event) => keyed(event, value, onChange)}\n            style={{ flex: 1, minHeight: touch(s, ROW), justifyContent: \"center\", cursor: \"pointer\" }}\n"],
      ["// The 44 pt target, as the switch row's.\nconst ROW = 44;\n", "// The 44 pt target, as the switch row's.\nconst ROW = 44;\n\n// A key the row moves the volume for is its own: the page does not scroll on it.\nfunction keyed(event: { nativeEvent: { key: string }; preventDefault: () => void }, value: number, onChange: (next: number) => void): void {\n  const next = volumeKey(event.nativeEvent.key, value);\n  if (next === null) return;\n  event.preventDefault();\n  onChange(next);\n}\n"],
    ],
  },
  {
    phone: "src/ui/text.tsx",
    web: "src/ui/web/text.canvaskit.tsx",
    from: "// Bold Text (the phone's",
    edits: [
      ["export function Text({ className, ...props }:", "export function Text({ className, children, ...props }:"],
      ["  return <NativeText className={face} {...props} />;\n", "  return (\n    <NativeText className={face} {...props}>\n      {clickChildren(children)}\n    </NativeText>\n  );\n"],
    ],
  },
  {
    phone: "src/screens/data/database-error.tsx",
    web: "src/screens/data/database-error.canvaskit.tsx",
    from: "export class DatabaseBoundary",
    edits: [],
  },
  {
    // The hooks the held layer shares with the phone's spotlight layer (the header of held-layer.tsx: change the two together).
    phone: "src/play/spotlight/layer.native.tsx",
    web: "src/play/spotlight/held-layer.tsx",
    from: "  const s = useUiScale();\n",
    to: "  }, [canPlay]);\n",
    edits: [],
  },
  {
    phone: "src/play/canvas/table-canvas.native.tsx",
    web: "src/play/canvas/row-feet-probe.tsx",
    from: "// Until the screen has measured",
    to: "  return null;\n}\n",
    edits: [["function RowFeetProbe", "export function RowFeetProbe"]],
  },
  {
    // The browser decodes and resizes each card picture off the main thread (createImageBitmap) in place of CanvasKit's decode and halving steps,
    // a few at once.
    phone: "src/play/canvas/table-images.native.ts",
    web: "src/play/canvas/table-images.canvaskit.ts",
    edits: [
      ["import { FilterMode, MipmapMode, Skia, type SkImage } from \"@shopify/react-native-skia\";\n", "import { Skia, type SkImage } from \"@shopify/react-native-skia\";\n"],
      ["import { Image as RNImage, PixelRatio } from \"react-native\";\n\n", "import { Image as RNImage, PixelRatio } from \"react-native\";\n\nimport { encodedSize } from \"../../ui/skia/encoded-size.ts\";\n"],
      ["// Draws `image` into a surface `w` x `h` with linear filtering, and releases `image`.\nfunction redraw(image: SkImage, w: number, h: number): SkImage {\n  const surface = Skia.Surface.Make(w, h);\n  if (!surface) return image;\n  surface.getCanvas().drawImageRectOptions(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, w, h), FilterMode.Linear, MipmapMode.None);\n  const next = surface.makeImageSnapshot();\n  surface.dispose();\n  image.dispose();\n  return next;\n}\n\n// The decoded file brought down to cover `box` (pixels), keeping its shape: halved while it is more than twice the size (each\n// linear step then averages every pixel it drops), then drawn to the size.\nfunction atSize(full: SkImage, box: Box): SkImage {\n  const target = coverPixels({ w: full.width(), h: full.height() }, box, 1);\n  let image = full;\n  while (image.width() >= 2 * target.w && image.height() >= 2 * target.h) {\n    const half = redraw(image, Math.round(image.width() / 2), Math.round(image.height() / 2));\n    // No surface (memory pressure): keep what there is rather than try again.\n    if (half === image) return image;\n    image = half;\n  }\n  return image.width() === target.w && image.height() === target.h ? image : redraw(image, target.w, target.h);\n}\n\n", "// The file decoded by the browser at the size that covers `box` (pixels), keeping its shape: createImageBitmap decodes and resizes it off the main\n// thread, with the filter that matches the phone's halving steps (resizeQuality \"medium\"), and CanvasKit takes the bitmap as an image it uploads\n// to each canvas that draws it. A file whose header does not give its size is decoded whole first, then resized from that bitmap.\n"],
      ["    const data = await Skia.Data.fromURI(uri);\n    const full = Skia.Image.MakeImageFromEncoded(data);\n    data.dispose();\n    return full ? atSize(full, box) : null;\n", "    const response = await fetch(uri);\n    if (!response.ok) return null;\n    const blob = await response.blob();\n    const declared = encodedSize(new Uint8Array(await blob.arrayBuffer()));\n    const whole = declared ? null : await createImageBitmap(blob);\n    const size = declared ?? { w: whole?.width ?? 0, h: whole?.height ?? 0 };\n    const target = coverPixels(size, box, 1);\n    const options: ImageBitmapOptions = { resizeWidth: target.w, resizeHeight: target.h, resizeQuality: \"medium\" };\n    const bitmap = await (whole ? createImageBitmap(whole, options) : createImageBitmap(blob, options));\n    whole?.close();\n    return Skia.Image.MakeImageFromNativeBuffer(bitmap);\n"],
      ["// How long a frame may spend decoding before the rest wait for the next frame (ms): the work that blocks the JS thread is the\n// decode and the downscale, and a 60 Hz frame is 16 ms.\nconst FRAME_BUDGET = 6;\n", "// How many decodes run at once. The browser decodes on threads of its own, so the main thread only starts each and takes its bitmap, and a\n// few side by side fill a table of twenty cards in a few frames, where one at a time waited out each decode.\nconst AT_ONCE = 4;\n"],
      [" * The decodes run one at a time, and the next starts at once while the frame has used under FRAME_BUDGET ms (one decode at least),\n * else a frame later, so a draw of several cards does not stall the frames after it.\n", " * Up to AT_ONCE decodes run at a time, each started as soon as one ends: the browser decodes off the main thread, so a draw of several\n * cards does not stall the frames after it.\n"],
      ["  private busy = false;\n", "  private running = 0;\n"],
      ["  // The frames waiting: one to announce what has finished, one to start the next decode.\n", "  // The frame waiting to announce what has finished.\n"],
      ["  private pumping: number | null = null;\n", ""],
      ["    if (this.pumping != null) cancelAnimationFrame(this.pumping);\n", ""],
      ["    this.announcing = null;\n    this.pumping = null;\n", "    this.announcing = null;\n"],
      ["  // Decodes the next job, then the one after it while the frame (begun at `began`, ms) has budget left, else a frame later.\n  private pump(began: number = performance.now()): void {\n    if (this.busy) return;\n    const next = this.next();\n    if (!next) return;\n    const [code, job] = next;\n    this.queue.delete(code);\n    // The box the code wants now, not the one it was queued for; a code that left the table is not decoded.\n    const wanted = this.wanted.get(code);\n    if (!wanted) {\n      this.loading.delete(code);\n      this.pump(began);\n      return;\n    }\n    const box = redecode(job.box, wanted, this.slack) ? wanted : job.box;\n    this.busy = true;\n    void decode(job.source, box).then((image) => {\n      this.busy = false;\n      if (this.loading.get(code) === job.box) this.loading.delete(code);\n      this.keep(code, box, image);\n      if (performance.now() - began < FRAME_BUDGET) {\n        this.pump(began);\n        return;\n", "  // Starts the next jobs while fewer than AT_ONCE decodes run; each that ends starts the next.\n  private pump(): void {\n    while (this.running < AT_ONCE) {\n      const next = this.next();\n      if (!next) return;\n      const [code, job] = next;\n      this.queue.delete(code);\n      // The box the code wants now, not the one it was queued for; a code that left the table is not decoded.\n      const wanted = this.wanted.get(code);\n      if (!wanted) {\n        this.loading.delete(code);\n        continue;\n"],
      ["      this.pumping = requestAnimationFrame(() => {\n        this.pumping = null;\n", "      const box = redecode(job.box, wanted, this.slack) ? wanted : job.box;\n      this.running += 1;\n      void decode(job.source, box).then((image) => {\n        this.running -= 1;\n        if (this.loading.get(code) === job.box) this.loading.delete(code);\n        this.keep(code, box, image);\n"],
      ["      });\n    });\n", "      });\n    }\n"],
    ],
  },
  {
    // expo-sqlite's own file, copied for the synchronous save's wall-clock wait (src/screens/data/web/sync-wait.ts); metro.config.js serves the copy on the web platform.
    phone: "node_modules/expo-sqlite/web/WorkerChannel.ts",
    web: "src/screens/data/web/worker-channel.ts",
    edits: [
      ["import { Deferred } from './Deferred';\nimport { serialize, deserialize } from './SyncSerializer';\nimport {\n", "import { Deferred } from '../../../../node_modules/expo-sqlite/web/Deferred';\nimport { serialize, deserialize } from '../../../../node_modules/expo-sqlite/web/SyncSerializer';\nimport { SYNC_CLOCK_EVERY, giveBackSyncBuffers, noteSyncWait, syncWaitExpired, takeSyncBuffers } from './sync-wait';\nimport {\n"],
      ["} from './web.types';", "} from '../../../../node_modules/expo-sqlite/web/web.types';"],
      [
        "  const lockBuffer = new SharedArrayBuffer(4);\n  const lock = new Int32Array(lockBuffer);\n  const resultBuffer = new SharedArrayBuffer(1024 * 1024);\n",
        "  const buffers = takeSyncBuffers();\n  const { lockBuffer, resultBuffer } = buffers;\n  const lock = new Int32Array(lockBuffer);\n",
      ],
      ["  resultCopy.set(new Uint8Array(resultArray.buffer, 4, length));\n", "  resultCopy.set(new Uint8Array(resultArray.buffer, 4, length));\n  giveBackSyncBuffers(buffers);\n"],
      [
        "  let i = 0;\n  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause\n  const useAtomicsPause = typeof Atomics.pause === 'function';\n  while (Atomics.load(lock, 0) === PENDING) {\n    ++i;\n\n    if (useAtomicsPause) {\n      if (i > 1_000_000) {\n        throw new Error('Sync operation timeout');\n      }\n      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause\n      Atomics.pause();\n    } else {\n      // NOTE(kudo): Unfortunate for the busy loop,\n      // because we don't have a way for main thread to yield its execution to other callbacks.\n      if (i > 1000_000_000) {\n        throw new Error('Sync operation timeout');\n      }\n    }\n  }\n",
        "  const startedAt = performance.now();\n  let i = 0;\n  const useAtomicsPause = typeof Atomics.pause === 'function';\n  while (Atomics.load(lock, 0) === PENDING) {\n    ++i;\n\n    if (i % SYNC_CLOCK_EVERY === 0 && syncWaitExpired(startedAt, performance.now())) {\n      throw new Error('Sync operation timeout');\n    }\n    if (useAtomicsPause) {\n      Atomics.pause();\n    }\n  }\n  noteSyncWait(startedAt, performance.now());\n",
      ],
    ],
  },
];

describe("web variants that copy a phone file", () => {
  for (const { phone, web, from, to, edits } of COPIES) {
    it(`${web} is ${phone} apart from its listed edits`, () => {
      let expected = body(read(phone), from, to);
      for (const [from, to] of edits) {
        expect(expected.split(from).length - 1, `the phone's file no longer holds: ${from}`).toBe(1);
        expected = expected.replace(from, () => to);
      }
      expect(body(read(web), from, to)).toBe(expected);
    });
  }
});

// Metro keeps one answer for a specifier a folder asks twice (per origin folder, specifier and platform), and metro.config.js redirects a phone file to its variant for every
// importer but the variant itself. So the specifier a variant uses to reach its phone file must be one no other file in its folder uses: otherwise a cached answer sent that file to
// the variant (or the variant to itself) depending on who asked first.
describe("the specifier a web variant reaches its phone file by", () => {
  const variants = tracked(["src"]).filter((file) => /\.canvaskit\.tsx?$/.test(file));
  const sourcesIn = (dir: string): string[] => tracked(["src"]).filter((file) => path.posix.dirname(file) === dir && /\.tsx?$/.test(file));

  it("finds the variants this check is about", () => {
    expect(variants.length).toBeGreaterThan(5);
  });

  for (const variant of variants) {
    it(`${variant} is the only file of its folder that asks for its phone file's specifier`, () => {
      const dir = path.posix.dirname(variant);
      const text = read(variant);
      const phoneBase = path.posix.basename(variant).replace(/\.canvaskit\.tsx?$/, "");
      const phoneFiles = [path.posix.join(dir, `${phoneBase}.native`), path.posix.join(dir, phoneBase), path.posix.join(dir, "..", `${phoneBase}.native`), path.posix.join(dir, "..", phoneBase)].map((file) => path.posix.normalize(file));
      const specifiers = [...text.matchAll(/from\s+["'](\.[^"']*)["']/g)]
        .map((match) => match[1] ?? "")
        .filter((specifier) => phoneFiles.includes(path.posix.normalize(path.posix.join(dir, specifier.replace(/\.tsx?$/, "")))));
      // A variant that is a copy of its phone file imports nothing of it; a copy of the whole file has no specifier to share.
      for (const specifier of specifiers) {
        const askers = sourcesIn(dir).filter((file) => file !== variant && !/\.test\.tsx?$/.test(file) && new RegExp(`["']${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(read(file)));
        expect(askers, `${specifier} is also asked for by ${askers.join(", ")}`).toEqual([]);
      }
    });
  }
});

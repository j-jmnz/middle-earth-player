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
    phone: "src/play/chrome/setting-rows.tsx",
    web: "src/play/chrome/setting-rows.canvaskit.tsx",
    from: "/**\n * The groups: Display",
    edits: [
      [
        '          {/* The web build is already a list of names: the row would change nothing there. */}\n          {Platform.OS !== "web" ? (\n            <ChoiceRow title="Table as a list" detail={TABLE_LIST_LINE} id={id("table-list")} options={TABLE_LIST_OPTIONS} words={TABLE_LIST_WORDS} value={settings.tableAsList} onChange={(tableAsList) => onChange({ tableAsList })} />\n          ) : null}\n',
        '          <ChoiceRow title="Table as a list" detail={TABLE_LIST_LINE} id={id("table-list")} options={TABLE_LIST_OPTIONS} words={TABLE_LIST_WORDS} value={settings.tableAsList} onChange={(tableAsList) => onChange({ tableAsList })} />\n',
      ],
      ["  const fogStill = reduced;\n", "  const fogStill = reduced;\n  const extra = useContext(ExtraSettingsRows);\n"],
      ["detail={fogLine(light, reduced)}", "detail={noBattery(fogLine(light, reduced))}"],
      ["detail={AWAKE_LINE}", "detail={noBattery(AWAKE_LINE)}"],
      ['          <SettingSwitch roomy label="Haptics" detail={HAPTICS_LINE} value={settings.haptics} onChange={(haptics) => onChange({ haptics })} testID={id("haptics")} />\n', ""],
      ["      ) : null}\n    </>\n", '      ) : null}\n\n      {groups.includes("table") ? extra : null}\n    </>\n'],
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
    phone: "src/screens/settings/store.ts",
    web: "src/screens/settings/store.canvaskit.ts",
    from: "/**\n * Loads the table settings",
    edits: [],
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
    // expo-sqlite's own file, copied for the synchronous save's wall-clock wait (src/screens/data/web/sync-wait.ts); metro.config.js serves the copy on the web platform.
    phone: "node_modules/expo-sqlite/web/WorkerChannel.ts",
    web: "src/screens/data/web/worker-channel.ts",
    edits: [
      ["import { Deferred } from './Deferred';\nimport { serialize, deserialize } from './SyncSerializer';\nimport {\n", "import { Deferred } from '../../../../node_modules/expo-sqlite/web/Deferred';\nimport { serialize, deserialize } from '../../../../node_modules/expo-sqlite/web/SyncSerializer';\nimport { SYNC_CLOCK_EVERY, syncWaitExpired } from './sync-wait';\nimport {\n"],
      ["} from './web.types';", "} from '../../../../node_modules/expo-sqlite/web/web.types';"],
      [
        "  let i = 0;\n  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause\n  const useAtomicsPause = typeof Atomics.pause === 'function';\n  while (Atomics.load(lock, 0) === PENDING) {\n    ++i;\n\n    if (useAtomicsPause) {\n      if (i > 1_000_000) {\n        throw new Error('Sync operation timeout');\n      }\n      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause\n      Atomics.pause();\n    } else {\n      // NOTE(kudo): Unfortunate for the busy loop,\n      // because we don't have a way for main thread to yield its execution to other callbacks.\n      if (i > 1000_000_000) {\n        throw new Error('Sync operation timeout');\n      }\n    }\n  }\n",
        "  const startedAt = performance.now();\n  let i = 0;\n  const useAtomicsPause = typeof Atomics.pause === 'function';\n  while (Atomics.load(lock, 0) === PENDING) {\n    ++i;\n\n    if (i % SYNC_CLOCK_EVERY === 0 && syncWaitExpired(startedAt, performance.now())) {\n      throw new Error('Sync operation timeout');\n    }\n    if (useAtomicsPause) {\n      Atomics.pause();\n    }\n  }\n",
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

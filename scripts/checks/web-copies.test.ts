// A web variant that has to copy a phone file (metro.config.js serves `X.canvaskit.ts(x)` in its place on the web platform) differs from it by the listed edits and nothing
// else, so a change to the phone's file shows up here until the copy follows it (docs/plans/desktop.md, What does not move).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./tracked.ts";

type Edit = readonly [from: string, to: string];

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
// The file from `marker` on, or without its opening `//` comment: each copy has a header of its own.
const body = (text: string, marker?: string): string => {
  const start = marker === undefined ? text.search(/^(?!\/\/)/m) : text.indexOf(marker);
  expect(start, `no ${marker} in the file`).toBeGreaterThanOrEqual(0);
  return text.slice(start);
};

const COPIES: readonly { phone: string; web: string; from?: string; edits: readonly Edit[] }[] = [
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
    // expo-sqlite's own file, copied for the synchronous save's wall-clock wait (src/screens/data/web/sync-wait.ts); metro.config.js serves the copy on the web platform.
    phone: "node_modules/expo-sqlite/web/WorkerChannel.ts",
    web: "src/screens/data/web/worker-channel.ts",
    edits: [
      ["import { Deferred } from './Deferred';\nimport { serialize, deserialize } from './SyncSerializer';\nimport {\n", "import { Deferred } from '../../../../node_modules/expo-sqlite/web/Deferred';\nimport { serialize, deserialize } from '../../../../node_modules/expo-sqlite/web/SyncSerializer';\nimport { SYNC_CLOCK_EVERY, syncWaitExpired } from './sync-wait';\nimport {\n"],
      ["} from './web.types';", "} from '../../../../node_modules/expo-sqlite/web/web.types';"],
      [
        "  let i = 0;\n  // @ts-expect-error: Remove this when TypeScript supports Atomics.pause\n  const useAtomicsPause = typeof Atomics.pause === 'function';\n  while (Atomics.load(lock, 0) === PENDING) {\n    ++i;\n\n    if (useAtomicsPause) {\n      if (i > 1_000_000) {\n        throw new Error('Sync operation timeout');\n      }\n      // @ts-expect-error: Remove this when TypeScript supports Atomics.pause\n      Atomics.pause();\n    } else {\n      // NOTE(kudo): Unfortunate for the busy loop,\n      // because we don't have a way for main thread to yield its execution to other callbacks.\n      if (i > 1000_000_000) {\n        throw new Error('Sync operation timeout');\n      }\n    }\n  }\n",
        "  const startedAt = performance.now();\n  let i = 0;\n  const useAtomicsPause = typeof Atomics.pause === 'function';\n  while (Atomics.load(lock, 0) === PENDING) {\n    ++i;\n\n    if (i % SYNC_CLOCK_EVERY === 0 && syncWaitExpired(startedAt, performance.now())) {\n      throw new Error('Sync operation timeout');\n    }\n    if (useAtomicsPause) {\n          Atomics.pause();\n    }\n  }\n",
      ],
    ],
  },
];

describe("web variants that copy a phone file", () => {
  for (const { phone, web, from, edits } of COPIES) {
    it(`${web} is ${phone} apart from its listed edits`, () => {
      let expected = body(read(phone), from);
      for (const [from, to] of edits) {
        expect(expected.split(from).length - 1, `the phone's file no longer holds: ${from}`).toBe(1);
        expected = expected.replace(from, () => to);
      }
      expect(body(read(web), from)).toBe(expected);
    });
  }
});

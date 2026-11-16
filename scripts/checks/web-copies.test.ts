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

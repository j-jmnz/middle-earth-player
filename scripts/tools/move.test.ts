import { describe, expect, it } from "vitest";

import { expandEntries, planMove } from "./move.ts";

// An in-memory repository: path to text (null for a file the tool must not read, as a binary).
function repo(files: Record<string, string | null>) {
  const tracked = Object.keys(files);
  return { tracked, read: (file: string) => files[file] ?? null };
}

describe("pnpm move", () => {
  it("expands folders, one-star patterns and companions", () => {
    const tracked = [
      "src/play/spotlight-fx.tsx",
      "src/play/spotlight-fx.native.tsx",
      "src/play/spotlight-beats.test.ts",
      "src/play/layout.ts",
      "src/play/layout.test.ts",
      "src/play/icons/generated.ts",
      "src/play/deep/x-y.ts",
    ];
    const moves = expandEntries({ "src/play/spotlight-*": "src/play/spotlight/*", "src/play/layout.ts": "src/play/layout/index.ts", "src/play/icons": "src/ui/icons" }, tracked);
    expect(Object.fromEntries(moves)).toEqual({
      "src/play/spotlight-fx.tsx": "src/play/spotlight/fx.tsx",
      "src/play/spotlight-fx.native.tsx": "src/play/spotlight/fx.native.tsx",
      "src/play/spotlight-beats.test.ts": "src/play/spotlight/beats.test.ts",
      "src/play/layout.ts": "src/play/layout/index.ts",
      "src/play/layout.test.ts": "src/play/layout/index.test.ts",
      "src/play/icons/generated.ts": "src/ui/icons/generated.ts",
    });
    expect(() => expandEntries({ "src/nothing": "src/x" }, tracked)).toThrow(/neither/);
  });

  it("re-aims relative imports from moved files and at moved files, keeping each specifier's style", () => {
    const { tracked, read } = repo({
      "src/play/a.ts": 'import { b } from "./b.ts";\nimport c from "./c";\nconst sql = require("../../drizzle/0000.sql");\nconst url = new URL("./data.json", import.meta.url);\n',
      "src/play/b.ts": 'export { a } from "./a.ts";\nexport * from "./sub";\n',
      "src/play/c.tsx": "export default 1;\n",
      "src/play/c.native.tsx": "export default 2;\n",
      "src/play/data.json": null,
      "src/play/sub/index.ts": "export const s = 1;\n",
      "drizzle/0000.sql": null,
    });
    const plan = planMove(tracked, { "src/play/a.ts": "src/play/store/a.ts", "src/play/c.tsx": "src/ui/c.tsx" }, read);
    expect(plan.moves.get("src/play/c.native.tsx")).toBe("src/ui/c.native.tsx");
    expect(plan.writes.get("src/play/store/a.ts")).toBe(
      'import { b } from "../b.ts";\nimport c from "../../ui/c";\nconst sql = require("../../../drizzle/0000.sql");\nconst url = new URL("../data.json", import.meta.url);\n',
    );
    expect(plan.writes.get("src/play/b.ts")).toBe('export { a } from "./store/a.ts";\nexport * from "./sub";\n');
    expect(plan.warnings).toEqual([]);
  });

  it("keeps a folder specifier while the folder still holds files, and follows a folder that moved whole", () => {
    const { tracked, read } = repo({
      "src/rules/families/index.ts": 'import { run } from "./sea.ts";\n',
      "src/rules/families/sea.ts": 'import { s } from "../state.ts";\n',
      "src/rules/families/sea-boarding.ts": 'import { run } from "./sea.ts";\n',
      "src/rules/state.ts": 'const dir = "./families/";\n',
      "src/play/icons/generated.ts": "",
      "src/play/x.ts": 'import "./icons/generated.ts";\nconst d = "./icons";\n',
    });
    const plan = planMove(tracked, { "src/rules/families/sea.ts": "src/rules/families/sea/index.ts", "src/rules/families/sea-*": "src/rules/families/sea/*", "src/play/icons": "src/ui/icons" }, read);
    expect(plan.writes.get("src/rules/families/index.ts")).toBe('import { run } from "./sea/index.ts";\n');
    expect(plan.writes.get("src/rules/families/sea/index.ts")).toBe('import { s } from "../../state.ts";\n');
    expect(plan.writes.get("src/rules/families/sea/boarding.ts")).toBe('import { run } from "./index.ts";\n');
    expect(plan.writes.has("src/rules/state.ts")).toBe(false);
    expect(plan.writes.get("src/play/x.ts")).toBe('import "../ui/icons/generated.ts";\nconst d = "../ui/icons";\n');
  });

  it("rewrites paths written from the root in docs, configs and comments, longest match first", () => {
    const { tracked, read } = repo({
      "src/play/layout.ts": "// see src/play/layout-slots.ts\n",
      "src/play/layout-slots.ts": "",
      "src/play/icons/generated.ts": "",
      "docs/architecture.md": "`src/play/layout.ts`, `src/play/layout-slots.ts`, src/play/layout and src/play/icons/. Also src/play/layouts.\n",
      "package.json": '{ "scripts": { "a": "node scripts/build-catalog.ts" } }\n',
      "scripts/build-catalog.ts": "",
      "data/cards/x.json": '"src/play/layout.ts"',
    });
    const plan = planMove(tracked, { "src/play/layout.ts": "src/play/layout/layout.ts", "src/play/icons": "src/ui/icons", "scripts/build-catalog.ts": "scripts/build/build-catalog.ts" }, read);
    expect(plan.writes.get("docs/architecture.md")).toBe("`src/play/layout/layout.ts`, `src/play/layout-slots.ts`, src/play/layout/layout and src/ui/icons/. Also src/play/layouts.\n");
    expect(plan.writes.get("package.json")).toBe('{ "scripts": { "a": "node scripts/build/build-catalog.ts" } }\n');
    expect(plan.writes.has("data/cards/x.json")).toBe(false);
  });

  it("rewrites a unique tail of a moved path, and a bare file name only when it changes", () => {
    const { tracked, read } = repo({
      "src/rules/families/sea-ships.ts": "",
      "src/rules/families/sea.ts": "",
      "src/play/sea.ts": "",
      "src/play/layout.ts": "",
      "src/catalog/x.ts": "// families/sea-ships.ts, rules/families/sea-ships.ts, sea-ships.ts and layout.ts; families/sea.ts\n",
    });
    const plan = planMove(tracked, { "src/rules/families/sea.ts": "src/rules/families/sea/index.ts", "src/rules/families/sea-*": "src/rules/families/sea/*", "src/play/layout.ts": "src/play/layout/layout.ts" }, read);
    expect(plan.writes.get("src/catalog/x.ts")).toBe("// families/sea/ships.ts, rules/families/sea/ships.ts, sea/ships.ts and layout.ts; families/sea/index.ts\n");
  });

  it("re-aims relative Markdown links, keeping anchors and the bare style", () => {
    const { tracked, read } = repo({
      "docs/phases/phase-01.md": "[brief](../brief.md#core-round) and [status](STATUS.md) and [web](https://x.dev/a.md)\n",
      "docs/phases/STATUS.md": "[one](phase-01.md)\n",
      "docs/brief.md": "",
    });
    const plan = planMove(tracked, { "docs/phases/phase-01.md": "docs/phases/done/phase-01.md" }, read);
    expect(plan.writes.get("docs/phases/done/phase-01.md")).toBe("[brief](../../brief.md#core-round) and [status](../STATUS.md) and [web](https://x.dev/a.md)\n");
    expect(plan.writes.get("docs/phases/STATUS.md")).toBe("[one](done/phase-01.md)\n");
  });

  it("re-aims a moved file's path to an untracked build output", () => {
    const { tracked, read } = repo({ "src/screens/open-databases.ts": 'const db = require("../../assets/catalog.db");\n' });
    const plan = planMove(tracked, { "src/screens/open-databases.ts": "src/screens/data/open-databases.ts" }, read, { exists: (file) => file === "assets/catalog.db" });
    expect(plan.writes.get("src/screens/data/open-databases.ts")).toBe('const db = require("../../../assets/catalog.db");\n');
    expect(plan.warnings).toEqual([]);
  });

  it("warns about paths it cannot follow and refuses a collision", () => {
    const { tracked, read } = repo({
      "scripts/a.ts": 'const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");\nconst g = `./golden/${id}.json`;\n',
      "scripts/b.ts": "",
    });
    const plan = planMove(tracked, { "scripts/a.ts": "scripts/tools/a.ts" }, read);
    expect(plan.warnings).toHaveLength(2);
    expect(() => planMove(tracked, { "scripts/a.ts": "scripts/b.ts" }, read)).toThrow(/both land/);
  });
});

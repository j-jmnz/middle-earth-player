// The board's glow, dim and marks for the open moment (highlight-of.ts): they follow the sheet's cards on the table whether or not the
// tray lists the choice, and only a sheet with no option on the table leaves the board unlit (docs/design-system-table.md, Choice tray).
import { describe, expect, it } from "vitest";

import { seaFixture } from "../dream-chaser/sea-fixture.ts";
import type { Sheet } from "../choice/sheet-types.ts";
import { boardUnlit, highlightKeys, highlightOf } from "./highlight-of.ts";

describe("boardUnlit", () => {
  const fixture = seaFixture({ staging: 3, engaged: 0 });
  const [a, b, c] = [fixture.ids.staged0!, fixture.ids.staged1!, fixture.ids.staged2!];
  const option = (id: string, mark?: { icon: "damage"; value: number; danger: boolean }) => ({ id, label: id, code: "galley", ...(mark ? { mark } : {}) });
  const pick: Sheet = { kind: "multi", key: "k", step: "Quest", title: "Pick", note: null, verb: "Pick", options: [option(a, { icon: "damage", value: 2, danger: false }), option(b)], build: { kind: "Commit" }, allowEmpty: false, preselected: [], alternative: null };
  const keysOf = (onTable: (id: string) => boolean) => highlightKeys({ game: fixture.state, seat: 0, sheet: pick, choice: { key: "k", ids: [], shares: [] }, panel: boardUnlit(true, pick, onTable) });

  it("glows the options still on the table, dims the others and keeps the marks while one option is folded and the tray is open", () => {
    const highlight = highlightOf(keysOf((id) => id !== b));
    expect(highlight.tappable.has(a)).toBe(true);
    expect(highlight.tappable.has(c)).toBe(false);
    expect(highlight.dimOthers).toBe(true);
    expect(highlight.marks.get(a)).toEqual({ icon: "damage", value: 2, danger: false });
  });

  it("leaves the board unlit only when no option is on the table", () => {
    expect(keysOf(() => false).glow).toBe("");
    expect(keysOf(() => false).dim).toBe(false);
    expect(boardUnlit(false, pick, () => false)).toBe(false);
  });
});

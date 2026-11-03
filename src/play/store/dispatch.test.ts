// The accepted callback of dispatch (the table's Sent tick): called once for an accepted intent, after the reducer accepts it and before the
// next state is built and the save written; never for a refused one, which gets the Refused tick instead (use-table-choice.ts).
import { describe, expect, it } from "vitest";

import { twoHanded } from "./seat-fixture.ts";
import { createTableStore } from "./store.ts";

describe("dispatch", () => {
  const duo = twoHanded();

  it("calls accepted once, before the table's state and the save change", () => {
    const seen: string[] = [];
    const store = createTableStore({ ctx: duo.ctx, game: duo.state, onCommit: () => seen.push("commit") });
    const before = store.getState().game;
    const ok = store.getState().dispatch({ type: "Pass" }, () => seen.push(store.getState().game === before ? "accepted, old state" : "accepted, new state"));
    expect(ok).toBe(true);
    expect(seen).toEqual(["accepted, old state", "commit"]);
  });

  it("does not call accepted for an intent the reducer refuses", () => {
    const store = createTableStore({ ctx: duo.ctx, game: duo.state });
    let called = 0;
    const ok = store.getState().dispatch({ type: "PlayCard", cardId: "no-such-card" } as never, () => (called += 1));
    expect(ok).toBe(false);
    expect(called).toBe(0);
    expect(store.getState().refusal).not.toBeNull();
  });
});

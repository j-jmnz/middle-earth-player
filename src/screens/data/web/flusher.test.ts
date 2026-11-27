// When the web app copies user.db to storage (src/screens/data/web/flusher.ts): only after a change, one copy at a time, the two files in turn, and again after a failure.
import { describe, expect, it } from "vitest";

import { createFlusher, type FlusherParts } from "./flusher";
import { SLOTS, type Slot } from "./snapshot";

function setup(over: Partial<FlusherParts> = {}) {
  const state = { changes: 0, written: [] as { data: string; generation: number; slot: Slot }[], tasks: [] as (() => void)[], errors: [] as unknown[] };
  const flusher = createFlusher({
    changes: async () => state.changes,
    serialize: async () => new TextEncoder().encode(`rows@${state.changes}`),
    persist: async (data, generation, slot) => {
      state.written.push({ data: new TextDecoder().decode(data), generation, slot });
    },
    start: { generation: 0, slot: null, changes: 0 },
    soon: (task) => state.tasks.push(task),
    onError: (error) => state.errors.push(error),
    ...over,
  });
  // Runs what `soon` was handed, then waits for the copy it started.
  const settle = async () => {
    for (const task of state.tasks.splice(0)) task();
    await flusher.flush();
  };
  return { state, flusher, settle };
}

describe("the web app's copy to storage", () => {
  it("writes nothing while nothing changed", async () => {
    const { state, flusher, settle } = setup();
    flusher.note();
    await settle();
    expect(state.written).toEqual([]);
  });

  it("makes one copy for many notes, and takes the files in turn", async () => {
    const { state, flusher, settle } = setup();
    state.changes = 3;
    flusher.note();
    flusher.note();
    flusher.note();
    expect(state.tasks).toHaveLength(1);
    await settle();
    expect(state.written).toEqual([{ data: "rows@3", generation: 1, slot: SLOTS[0] }]);
    state.changes = 4;
    flusher.note();
    await settle();
    expect(state.written.at(-1)).toEqual({ data: "rows@4", generation: 2, slot: SLOTS[1] });
    await flusher.flush();
    expect(state.written).toHaveLength(2);
  });

  it("goes on from the snapshot the database was opened from", async () => {
    const { state, flusher } = setup({ start: { generation: 8, slot: SLOTS[0], changes: 0 } });
    state.changes = 1;
    await flusher.flush();
    expect(state.written).toEqual([{ data: "rows@1", generation: 9, slot: SLOTS[1] }]);
  });

  it("runs the copies one at a time, and a second one with nothing new writes nothing", async () => {
    const { state, flusher } = setup();
    state.changes = 1;
    const first = flusher.flush();
    // Before the first copy has read the count: it takes these rows too.
    state.changes = 2;
    const second = flusher.flush();
    await Promise.all([first, second]);
    expect(state.written).toEqual([{ data: "rows@2", generation: 1, slot: SLOTS[0] }]);
  });

  it("reports a copy that failed, keeps the file it would have replaced and writes again at the next change", async () => {
    let fail = true;
    const written: { generation: number; slot: Slot }[] = [];
    const { state, flusher } = setup({
      persist: async (_data, generation, slot) => {
        if (fail) throw new Error("no space");
        written.push({ generation, slot });
      },
    });
    state.changes = 1;
    await flusher.flush();
    expect(state.errors).toHaveLength(1);
    fail = false;
    await flusher.flush();
    expect(written).toEqual([{ generation: 1, slot: SLOTS[0] }]);
  });
});

// The web app's save file (src/screens/data/web/snapshot.ts): a whole file reads back, a damaged or half-written one reads as nothing, and the two files take turns.
import { describe, expect, it } from "vitest";

import { decodeSnapshot, encodeSnapshot, HEADER_BYTES, newestOf, nextSlot, SLOTS } from "./snapshot";

const DATA = new TextEncoder().encode("SQLite format 3\u0000 and the rows of a game");

describe("the web app's snapshot file", () => {
  it("reads back what was written, with its generation", async () => {
    const file = await encodeSnapshot(DATA, 7);
    expect(file.length).toBe(HEADER_BYTES + DATA.length);
    expect(await decodeSnapshot(file)).toEqual({ generation: 7, data: DATA });
    expect(await decodeSnapshot(await encodeSnapshot(new Uint8Array(0), 1))).toEqual({ generation: 1, data: new Uint8Array(0) });
  });

  it("reads a view into a larger buffer", async () => {
    const file = await encodeSnapshot(DATA, 2);
    const padded = new Uint8Array(file.length + 16);
    padded.set(file, 8);
    expect(await decodeSnapshot(padded.subarray(8, 8 + file.length))).toEqual({ generation: 2, data: DATA });
  });

  it("refuses a file cut short, a changed byte, another file and a generation that is no count", async () => {
    const file = await encodeSnapshot(DATA, 3);
    expect(await decodeSnapshot(file.slice(0, file.length - 1))).toBeNull();
    expect(await decodeSnapshot(file.slice(0, HEADER_BYTES - 1))).toBeNull();
    const changed = file.slice();
    changed[file.length - 1] = changed[file.length - 1]! ^ 1;
    expect(await decodeSnapshot(changed)).toBeNull();
    expect(await decodeSnapshot(DATA)).toBeNull();
    expect(await decodeSnapshot(new Uint8Array(0))).toBeNull();
    expect(await decodeSnapshot(await encodeSnapshot(DATA, 0))).toBeNull();
    expect(await decodeSnapshot(await encodeSnapshot(DATA, 1.5))).toBeNull();
  });

  it("opens the newer whole file and writes the other one next", () => {
    const a = { generation: 4, data: DATA, slot: SLOTS[0] };
    const b = { generation: 5, data: DATA, slot: SLOTS[1] };
    expect(newestOf([a, b])).toBe(b);
    expect(newestOf([a, null])).toBe(a);
    expect(newestOf([null, null])).toBeNull();
    expect(nextSlot(null)).toBe(SLOTS[0]);
    expect(nextSlot(SLOTS[0])).toBe(SLOTS[1]);
    expect(nextSlot(SLOTS[1])).toBe(SLOTS[0]);
  });
});

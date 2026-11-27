// Rules: hrd.track, hrd.search-objective (data/rules/entries.json); ledger lines 17069:A:1, 17073:A:1, 17080:A:1. The banner's beat and the log's line for the steps that tell Track and the Search objective's flips.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../../rules/core/intents.ts";
import { momentOf } from "../../../store/outcome.ts";
import { tableFromLayout } from "../../../../../test/harness/scene-kit.ts";
import { lookIdsOf, lookStripWords, lookWordOf } from "../../look-strip.ts";
import { lineSpeech } from "../../../readouts/banner-speech.ts";
import { tellTrack, trackBeat, trackLogLine } from "./track.ts";

const NAMES: Record<string, string> = { tunnel: "Pitch Black Tunnel", guard: "Hive Guardian", a: "Cobwebbed Cavern", objective: "Off Track" };
const name = (id: string): string => NAMES[id] ?? id;
const cause = { rule: "hrd.track" } as never;
const track: EngineStep = { kind: "track", locationId: "tunnel", amount: 2, discarded: ["guard", "a"], marked: ["guard"], flipped: true, cause };

describe("Track's beat", () => {
  it("17069:A:1 says the discard, the card that shows On Track and the flip, and lays the discarded cards in the look strip on its last line", () => {
    const beat = trackBeat(track, name);
    expect(beat?.title).toBe("Track 2");
    expect(beat?.lines.map((line) => line.text)).toEqual(["Pitch Black Tunnel: 2 cards discarded", "Hive Guardian shows On Track", "The Search objective flips to On Track"]);
    const last = beat?.lines.at(-1)?.cards ?? [];
    expect(lookIdsOf(new Set(last))).toEqual(["guard", "a"]);
    expect(lookWordOf(last)).toBe("Track");
  });

  it("17069:A:1 a Track that finds no marked card says so", () => {
    const beat = trackBeat({ ...track, marked: [], flipped: false } as EngineStep, name);
    expect(beat?.lines.map((line) => line.text)).toEqual(["Pitch Black Tunnel: 2 cards discarded", "No card shows On Track"]);
  });

  it("17069:A:1 an empty deck and discard pile say no card could be discarded, and lay no strip", () => {
    const beat = trackBeat({ ...track, discarded: [], marked: [], flipped: false } as EngineStep, name);
    expect(beat?.lines.map((line) => line.text)).toEqual(["Pitch Black Tunnel: no card could be discarded"]);
    expect(beat?.lines.every((line) => lookIdsOf(new Set(line.cards)).length === 0)).toBe(true);
  });

  it("17073:A:1 a flip is a beat of one line, and the log tells both steps", () => {
    const flip: EngineStep = { kind: "searchFlip", cardId: "objective", to: "offTrack", cause };
    expect(trackBeat(flip, name)?.lines.map((line) => line.text)).toEqual(["The Search objective flips to Off Track"]);
    expect(trackLogLine(flip, name)).toBe("The Search objective flips to Off Track");
    expect(trackLogLine(track, name)).toBe("Track 2 at Pitch Black Tunnel: 2 cards discarded, the Search objective flips to On Track");
  });

  it("17069:A:1 a step of another kind tells nothing and opens no group", () => {
    const told: string[] = [];
    tellTrack({ kind: "commit", cardId: "x" }, name, { open: () => ({}), line: (text) => told.push(text), close: () => told.push("close") });
    expect(told).toEqual([]);
    expect(trackBeat({ kind: "commit", cardId: "x" }, name)).toBeNull();
  });

  it("17069:A:1 a screen reader hears the strip as Track's, a Discover's as before", () => {
    const last = trackBeat(track, name)?.lines.at(-1);
    expect(lineSpeech({ text: last?.text ?? "", mark: null, cards: last?.cards ?? [] })).toBe(lookStripWords(2, "Track"));
    expect(lookStripWords(2, "Track")).toBe("Track look, 2 cards placed in the encounter discard pile");
  });

  it("17069:A:1 the banner of the intent tells the beat, kept whole with the strip on its last line", () => {
    const made = tableFromLayout("beneath-the-sands", { seats: 1, stage: "17076", side: "B" });
    const moment = momentOf(made.state, made.state, [track], { card: name });
    expect(moment?.title).toBe("Track 2");
    expect(moment?.lines.map((line) => line.text)).toEqual(["Pitch Black Tunnel: 2 cards discarded", "Hive Guardian shows On Track", "The Search objective flips to On Track"]);
    expect(lookIdsOf(new Set(moment?.lines.at(-1)?.cards ?? []))).toEqual(["guard", "a"]);
  });
});

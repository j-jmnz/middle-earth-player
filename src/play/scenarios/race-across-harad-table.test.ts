// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage, hrd.prepare-the-orcs-area, rr.immune, rr.quest-advancement (data/rules/entries.json); ledger lines 17047:A:1, 17038:A:3, 17048:A:1, 17052:B:3, 17054:B:3
// (docs/scenarios/haradrim/race-across-harad.md, Table). What the table says of Race Across Harad's pieces: the Orcs' stage at the head of the staging row with its cards, where each card stands against the players' stage and what the
// same stage switches, the stage's progress against its quest points, the banner of the Orcs' advance and the words of the verbs. The engine decided each fact; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { modifiedStat } from "../../rules/core/modified-stat.ts";
import { idOf, run as runInstruction } from "../../../test/harness/scene-kit.ts";
import { advancedTo, CHIEFTAIN, prepared, stageId } from "../../rules/families/haradrim/race-kit.ts";

import { effectLines } from "../cards/card-effects.ts";
import { areaFacts, areaGroup, areaRoleOf, areaSpeech, stageFactsOf } from "../store/stormcaller-table.ts";
import { momentOf } from "../store/outcome.ts";
import { zoneSelector } from "../store/selectors.ts";
import { ORCS_APART, ORCS_SAME_STAGE, ORCS_STAGE_LOSS, ORCS_TOGETHER, orcsStageTitle, orcsTell, orcsVerbWords } from "../words/scenarios/haradrim/orcs-table.ts";
import { orcsBeats } from "../readouts/haradrim/orcs.ts";
import { previewCards } from "../cards/table-preview.ts";
import { tableFromLayout } from "../../../test/harness/scene-kit.ts";

const ROAD = "17042";
const APART = { staging: [ROAD], stage: "17048" };
const TOGETHER = { staging: [ROAD], stage: "17047" };
const lines = (t: ReturnType<typeof prepared>, id: string): readonly string[] => effectLines(settle(t.state, t.made.ctx, []), t.made.ctx, id, (card) => t.made.ctx.cards.get(t.state.cards[card]?.code ?? "")?.name ?? card);
const points = (t: ReturnType<typeof prepared>) => modifiedStat(t.state, t.state.cards[stageId(t.state)]!, "questPoints", t.made.ctx.cards);

describe("17047:A:1 the Orcs' area heads the staging row", () => {
  it("lists the Orcs' stage first and then the Uruk Chieftain, before the rest of the staging area", () => {
    const { made, state } = prepared(APART);
    const settled = settle(state, made.ctx, []);
    const group = areaGroup(settled);
    expect(group[0]).toBe(stageId(settled));
    expect(group[1]).toBe(idOf(settled, CHIEFTAIN));
    const entries = zoneSelector("staging", 0)(settled).entries;
    expect(entries.map((entry) => entry.card.id).slice(0, 2)).toEqual([group[0], group[1]]);
    expect(entries.map((entry) => entry.area)).toEqual(["stage", "apart", undefined]);
  });

  it("17047:A:1 marks the cards apart at another stage and together at the Orcs' stage, with no veil change in a game with no Orcs' area", () => {
    const apart = settle(prepared(APART).state, prepared(APART).made.ctx, []);
    expect(areaRoleOf(apart, idOf(apart, CHIEFTAIN))).toBe("apart");
    const same = prepared(TOGETHER);
    const together = settle(same.state, same.made.ctx, []);
    expect(areaRoleOf(together, idOf(together, CHIEFTAIN))).toBe("together");
    expect(areaRoleOf(together, idOf(together, ROAD))).toBeNull();
    const none = tableFromLayout("race-across-harad", { stage: "17048", staging: [ROAD] });
    expect(areaGroup(none.state)).toEqual([]);
    expect(areaFacts(none.state)).toBeNull();
  });

  it("17047:A:1 reads the Orcs' stage number of the last, the players' stage and whether they share it", () => {
    const t = prepared(APART);
    expect(areaFacts(settle(t.state, t.made.ctx, []))).toMatchObject({ who: "orcs", number: 1, last: 4, playersAt: 2, together: false });
    const same = prepared(TOGETHER);
    expect(areaFacts(settle(same.state, same.made.ctx, []))).toMatchObject({ number: 1, playersAt: 1, together: true });
  });
});

describe("hrd.orcs-area-same-stage what the same stage switches, said on the stage and its cards", () => {
  it("the Orcs' stage says its number, its progress against its quest points, where the players are, and what the same stage switches", () => {
    const t = prepared(APART);
    const text = lines(t, stageId(t.state));
    expect(text[0]).toBe(`The Orcs' stage 1 of 4 · 0/${points(t)} · the players are at stage 2: its cards are out of reach`);
    expect(text).toContain(ORCS_SAME_STAGE);
    expect(text.at(-1)).toBe("When this stage is full the Orcs advance");
  });

  it("the Orcs' stage at the same stage says its cards are in the staging area, and stage 3 and 4 say what filling them loses", () => {
    const t = prepared(TOGETHER);
    expect(lines(t, stageId(t.state))[0]).toMatch(/the players are at its stage: its cards are in the staging area$/);
    const third = advancedTo(t.made, t.state, 3);
    const later = { made: t.made, state: third };
    expect(lines(later, stageId(third)).at(-1)).toBe("When this stage is full the players lose if they are at stage 3; at another stage the Orcs advance");
    const last = { made: t.made, state: advancedTo(t.made, t.state, 4) };
    expect(lines(last, stageId(last.state)).at(-1)).toBe(ORCS_STAGE_LOSS);
  });

  it("a card of the area says it is apart and immune at another stage, and in the staging area at the Orcs' stage", () => {
    const apart = prepared(APART);
    expect(lines(apart, idOf(apart.state, CHIEFTAIN))).toContain(ORCS_APART);
    const same = prepared(TOGETHER);
    expect(lines(same, idOf(same.state, CHIEFTAIN))).toContain(ORCS_TOGETHER);
  });

  it("the facts the labels read carry the progress and the quest points of the stage", () => {
    const t = prepared(APART);
    const progress = runInstruction(t.made, t.state, { verb: "AddOrcsProgress", amount: 3 });
    expect(stageFactsOf(progress, points(t))).toMatchObject({ who: "orcs", progress: 3, points: points(t) });
    expect(orcsStageTitle(stageFactsOf(progress, 10)!)).toBe("Orcs · stage 1 of 4 · 3/10");
  });
});

describe("reader labels and list words", () => {
  it("the stage reads its numbers, its cards and its reach; a card reads where it is", () => {
    const t = prepared(APART);
    const settled = settle(t.state, t.made.ctx, []);
    const name = (card: { code: string }) => t.made.ctx.cards.get(card.code)?.name ?? card.code;
    const label = areaSpeech(settled, stageId(settled), name, 10);
    expect(label).toContain("Orcs · stage 1 of 4 · 0/10");
    expect(label).toContain("In the area: Uruk Chieftain");
    expect(label).toContain("Out of reach: the players are at another stage");
    expect(areaSpeech(settled, idOf(settled, CHIEFTAIN), name, 10)).toBe("Uruk Chieftain, in the Orcs' area, out of reach");
    expect(orcsTell("together")).toBe("in the Orcs' area, in the staging area");
  });
});

describe("17052:B:2 the Orcs' progress and advance in the banner", () => {
  it("the progress is told as the quest's is, and the advance of the Orcs is a beat of its own with no advance step", () => {
    const t = prepared(APART);
    const full = runInstruction(t.made, t.state, { verb: "AddOrcsProgress", amount: points(t) });
    const name = (id: string) => t.made.ctx.cards.get(full.cards[id]?.code ?? "")?.name ?? id;
    const beats = orcsBeats(t.state, full, name);
    expect(beats).toHaveLength(1);
    expect(beats[0]?.title).toBe("The Orcs advance");
    expect(beats[0]?.lines[0]).toBe(`The Orcs advance to stage 2 of 4: ${name(stageId(full))}`);
    expect(orcsBeats(t.state, t.state, name)).toEqual([]);
    const moment = momentOf(t.state, full, [], { card: name });
    expect(moment?.lines.map((line) => line.text).join("\n")).toContain("The Orcs advance to stage 2 of 4");
  });

  it("17054:B:3 the last stage's advance says that filling it loses", () => {
    const t = prepared(APART);
    const third = advancedTo(t.made, t.state, 3);
    const last = runInstruction(t.made, third, { verb: "AddOrcsProgress", amount: 20 });
    const beats = orcsBeats(third, last, (id) => id);
    expect(beats[0]?.lines.at(-1)).toBe(ORCS_STAGE_LOSS);
  });
});

describe("17038:A:1 to 17038:A:3 the Tamed Mûmak says what it takes and what its loss costs", () => {
  const preview = (seats: number) => {
    const t = tableFromLayout("race-across-harad", { seats, stage: "17048", play: ["17038"] });
    const id = idOf(t.state, "17038");
    return JSON.stringify(previewCards(t.state, t.ctx, id, (one) => ({ name: t.ctx.cards.get(one)?.name ?? one, source: null, text: "" }), (card) => t.ctx.cards.get(card)?.name ?? card));
  };

  it("solo it says all undefended damage goes to it and that its loss eliminates you", () => {
    const text = preview(1);
    expect(text).toContain("Your Tamed Mûmak, an objective ally immune to player card effects");
    expect(text).toContain("All damage of an undefended attack on you goes to it, past its hit points");
    expect(text).toContain("you are eliminated from the game");
  });

  it("two-handed it names the player", () => {
    expect(preview(2)).toMatch(/Player \d's Tamed Mûmak/);
  });
});

describe("the words of the verbs", () => {
  it("17047:A:1, 17042:A:1, 17038:A:3 each verb of the Orcs' area and the Mûmak has a sentence", () => {
    expect(orcsVerbWords({ verb: "MoveToOrcsArea" })).toBe("add this card to the Orcs' area");
    expect(orcsVerbWords({ verb: "AddOrcsProgress", amount: 2 })).toBe("place 2 progress on the Orcs' stage");
    expect(orcsVerbWords({ verb: "TakeObjectiveAlly", codes: ["17038"] })).toBe("take control of a Tamed Mûmak");
    expect(orcsVerbWords({ verb: "EliminateAfterAttack" })).toMatch(/eliminate/);
    expect(orcsVerbWords({ verb: "Pass" } as never)).toBeNull();
  });
});

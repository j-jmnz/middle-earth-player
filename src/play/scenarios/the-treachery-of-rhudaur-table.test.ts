// Rules: mec108.time-x, mec108.side-quests-in-play, mec108.the-investigation, mec108.objective-allies, mec108.indestructible, rr.explored, rr.attachment-cards, rr.first-player (data/rules/entries.json); ledger lines 10094:B:1, 10094:B:3, 10095:B:1, 10095:B:2, 10101:A:1, 10101:A:2, 10110:A:1, 10168:A:2, 10187:A:3.
// What the table says of The Treachery of Rhudaur's pieces: Secrets of Rhudaur's time counters and what the last does, the word "None" when there is no current quest, the Clue objectives (drawn under the character that carries one, in the staging area while unclaimed) and the 5 quest points each takes off
// stage 2B, each Forbidden Descent's progress sponge, Thaurdir's damage and burden, and the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { setCurrentQuest } from "../../rules/families/angmar/quest.ts";
import { absorbProgress } from "../../rules/families/angmar/sponge.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { zoneSelector } from "../store/selectors.ts";
import { idOf, legalIntents, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { dialProps } from "../readouts/dials.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { threatLevel } from "../readouts/threat-level.ts";
import { secretsTimeNearWords, secretsTimeWords } from "../words/scenarios/angmar/rhudaur-table.ts";

const ID = "the-treachery-of-rhudaur";
// The scenario's games hold the side quest rules from the first deal (the golden's opening checks it), whatever a layout stages.
const at = (layout: Layout = {}) => {
  const t = tableFromLayout(ID, { stage: "10094", phase: "Quest", ...layout });
  return { ...t, state: { ...t.state, sideQuests: true as const } };
};
const NAMES: Record<string, string> = { "10094": "Secrets of Rhudaur", "10095": "Thaurdir's Pursuit", "10098": "Thaurdir", "10101": "Forbidden Descent", "10109": "Quiet the Spirits", "10110": "Daechanar's Brand", "10112": "Heirloom of Iârchon", "10114": "Orders from Angmar", "10096": "Amarthiúl" };
const codeName = (code: string) => NAMES[code] ?? code;
const nameOf = (state: ScenarioState) => (id: string) => codeName(state.cards[id]?.code ?? id);
const dials = (t: ReturnType<typeof at>, state: ScenarioState = t.state) => scenarioDials(state, t.ctx, codeName);
const dial = (t: ReturnType<typeof at>, id: string, state: ScenarioState = t.state) => dials(t, state).find((one) => one.testID === id);
const detail = (t: ReturnType<typeof at>, state: ScenarioState, code: string) => angmarDetail(state, t.ctx, idOf(state, code), nameOf(state));

describe("Secrets of Rhudaur's time counters", () => {
  it("10094:B:1 shows the counters left, warns near at 2 and 1 and never goes critical, since the last counter only removes the side quests and advances the quest", () => {
    const t = at({ staging: ["10109", "10111"] });
    const stage = t.state.questStage ?? "";
    const time = (counters: number) => dial(t, `angmar-time:${stage}`, updateCard(t.state, stage, { resources: counters }));
    expect(time(5)).toMatchObject({ value: 5, label: "Time" });
    expect(time(5)?.warn).toBeUndefined();
    expect(time(3)?.warn).toBeUndefined();
    expect(time(2)?.warn).toEqual({ level: "near", words: "2 time counters are left." });
    expect(time(1)?.warn).toEqual({ level: "near", words: "The next refresh phase takes the last time counter: 2 Treachery of Rhudaur side quests leave the game and the quest advances to stage 2." });
    expect(time(5)?.note).toBe("5 time counters left. One comes off at the end of each refresh phase. With the last gone, 2 Treachery of Rhudaur side quests still quest side up leave the game and the quest advances to stage 2.");
    expect(threatLevel(1, undefined)).not.toBe("critical");
  });

  it("10094:B:2 says it truly with one side quest left and with none", () => {
    const one = at({ staging: ["10109"] });
    const stage = one.state.questStage ?? "";
    expect(dial(one, `angmar-time:${stage}`)?.note).toContain("With the last gone, 1 Treachery of Rhudaur side quest still quest side up leaves the game and the quest advances to stage 2.");
    // With none in play the quest has already advanced (10094:B:4), so the words are read straight: they stay true.
    expect(secretsTimeWords(3, 0)).toContain("With the last gone, no Treachery of Rhudaur side quest is left to remove and the quest advances to stage 2.");
    expect(secretsTimeNearWords(1, 0)).toBe("The next refresh phase takes the last time counter: the quest advances to stage 2.");
    expect(detail(one, one.state, "10094")).toContain("The quest advances to stage 2 when the last counter goes, or at once when no Treachery of Rhudaur side quest is in play (1 now).");
  });
});

describe("no current quest", () => {
  it("10094:B:3 names the state while the main quest card cannot be the current quest and no side quest was chosen, and only then", () => {
    const t = at({ staging: ["10109"] });
    const none = dial(t, "angmar-current");
    expect(none).toMatchObject({ label: "Quest", word: "None", value: 0 });
    expect(none?.note).toBe("Secrets of Rhudaur cannot be the current quest in the quest phase and no side quest was chosen, so there is no current quest. Progress beyond the active location's share is lost.");
    const chosen = syncConstants(settle(setCurrentQuest(t.state, idOf(t.state, "10109"), t.ctx), t.ctx, []), t.ctx);
    expect(dial(t, "angmar-current", chosen)).toBeUndefined();
    expect(dial(at({ staging: ["10109"], phase: "Planning" }), "angmar-current")).toBeUndefined();
    expect(dial(at({ stage: "10095", staging: ["10109"] }), "angmar-current")).toBeUndefined();
  });
});

describe("the Clue objectives and stage 2B", () => {
  it("10095:B:1 counts the Clues attached to characters against the 3, with the quest points left, and a Clue in the staging area counts for nothing", () => {
    const base = { stage: "10095", staging: ["10112"] } as const;
    const none = at(base);
    expect(dial(none, "angmar-clues")).toMatchObject({ value: 0, limit: 3, goal: true, label: "Clues" });
    expect(dial(none, "angmar-clues")?.warn).toBeUndefined();
    expect(dial(none, "angmar-clues")?.note).toBe("0 Clue objectives attached to characters. Stage 2B has 5 fewer quest points for each, 30 now. A Clue in the staging area counts for nothing.");
    const one = at({ ...base, attached: [{ code: "10110", to: "dh1" }] });
    expect(dial(one, "angmar-clues")).toMatchObject({ value: 1 });
    expect(dial(one, "angmar-clues")?.note).toBe("1 Clue objective attached to a character. Stage 2B has 5 fewer quest points for each, 25 now. A Clue in the staging area counts for nothing.");
    const two = at({ ...base, attached: [{ code: "10110", to: "dh1" }, { code: "10114", to: "dh1" }] });
    expect(dial(two, "angmar-clues")?.note).toContain("2 Clue objectives attached to characters. Stage 2B has 5 fewer quest points for each, 20 now.");
    expect(dialProps(dial(two, "angmar-clues")!).elimination).toBe(false);
    // Stage 1 draws no such dial.
    expect(dial(at({ attached: [{ code: "10110", to: "dh1" }] }), "angmar-clues")).toBeUndefined();
  });

  it("10095:B:1 says the stage's points in its preview", () => {
    const t = at({ stage: "10095", attached: [{ code: "10110", to: "dh1" }] });
    expect(detail(t, t.state, "10095")).toBe("25 quest points: 30, less 5 for each of the 1 Clue objective attached to a character. It is defeated with them and with no hit points left on Thaurdir, and then the players win.");
  });

  it("10110:A:1 draws a claimed Clue under its host, a hero or Amarthiúl, and an unclaimed one in the staging area", () => {
    const t = at({ stage: "10095", staging: ["10112"], play: ["10096"], attached: [{ code: "10110", to: "dh1" }] });
    const clue = idOf(t.state, "10110");
    const heroes = zoneSelector("play", 0)(t.state).entries.find((one) => one.card.id === idOf(t.state, "dh1"));
    expect(heroes?.attached.map((card) => card.id)).toContain(clue);
    expect(zoneSelector("staging", 0)(t.state).entries.some((one) => one.card.id === idOf(t.state, "10112"))).toBe(true);
    const amarthiul = at({ stage: "10095", play: ["10096"], attached: [{ code: "10110", to: "10096" }] });
    const holder = zoneSelector("play", 0)(amarthiul.state).entries.find((one) => one.card.id === idOf(amarthiul.state, "10096"));
    expect(holder?.attached.map((card) => card.id)).toContain(idOf(amarthiul.state, "10110"));
  });

  it("10110:A:1 says where a Clue lies and what it gives: unclaimed in the staging area, claimed on its host", () => {
    const t = at({ stage: "10095", staging: ["10112"], attached: [{ code: "10110", to: "dh1" }, { code: "10114", to: "dh1" }] });
    expect(detail(t, t.state, "10112")).toBe("Unclaimed, in the staging area. Any player may exhaust a ready hero they control, or Amarthiúl, to claim it and attach it to that character. Its host gets +1 Willpower.");
    expect(detail(t, t.state, "10110")).toBe("On dh1. Its host gets +1 Attack while attacking an Undead enemy. It takes 5 quest points off stage 2B, and a Clue boon is offered for it if the players win.");
    const pair = at({ seats: 2, stage: "10095", attached: [{ code: "10110", to: "dh1" }] });
    expect(detail(pair, pair.state, "10110")).toContain("On dh1, controlled by Player 1. ");
  });
});

describe("Forbidden Descent's sponge", () => {
  it("10101:A:1 draws a dial for each copy in the staging area: the progress it took this round against 2, warning once it is full", () => {
    const t = at({ phase: "Quest", staging: ["10101", "10101"] });
    expect(dials(t).filter((one) => one.testID?.startsWith("angmar-sponge:")).map((one) => [one.label, one.value])).toEqual([["Descent · 1", 0], ["Descent · 2", 0]]);
    const taken = absorbProgress(t.state, 3, t.ctx.cards, []);
    const [first, second] = dials(t, taken.state).filter((one) => one.testID?.startsWith("angmar-sponge:"));
    expect([first?.value, second?.value]).toEqual([2, 1]);
    expect(first?.warn).toEqual({ level: "near", words: "It has taken its 2 progress this round. The next progress placed on a quest goes to a copy that has room, else goes on the quest." });
    expect(second?.warn).toBeUndefined();
    expect(first?.note).toBe("2 of 2 progress taken this round. It takes the first 2 progress placed on a quest each round, 2 for each copy in the staging area. It holds 2 of 6 progress and is explored at 6.");
    expect(first?.limitWords).toBe("2 each round");
    // One copy is the plain "Descent"; none in the staging area, no dial.
    expect(dials(at({ staging: ["10101"] })).some((one) => one.label === "Descent")).toBe(true);
    expect(dials(at({ active: "10101" })).some((one) => one.testID?.startsWith("angmar-sponge:"))).toBe(false);
  });

  it("10101:A:2 says in its preview what leaving the staging area costs", () => {
    const t = at({ staging: [{ code: "10101", progress: 1 }] });
    expect(detail(t, t.state, "10101")).toBe("0 of 2 progress taken this round, 1 of 6 held. In the staging area it takes the first 2 progress placed on a quest each round. Explored, discarded or removed there, each player raises their threat by 2; travelling to it raises nothing.");
  });
});

describe("Thaurdir in this scenario", () => {
  it("10095:B:2 draws his damage against his hit points as a goal dial, with what stage 2B needs", () => {
    const t = at({ stage: "10095", staging: [{ code: "10098", damage: 4 }] });
    expect(dial(t, "angmar-thaurdir")).toMatchObject({ value: 4, limit: 9, goal: true });
    expect(dial(t, "angmar-thaurdir")?.note).toContain("Stage 2 needs its 30 progress and 9 damage on him");
    const clued = at({ stage: "10095", staging: [{ code: "10098", damage: 9 }], attached: [{ code: "10110", to: "dh1" }] });
    expect(dial(clued, "angmar-thaurdir")?.note).toContain("He has no hit points left: 25 progress wins");
  });

  it("10168:A:2 draws a burden under Thaurdir in the staging area and says where it lies", () => {
    const t = at({ stage: "10095", staging: ["10098"], attached: [{ code: "10168", to: "10098" }] });
    const burden = idOf(t.state, "10168");
    expect(zoneSelector("staging", 0)(t.state).entries.find((one) => one.card.id === idOf(t.state, "10098"))?.attached.map((card) => card.id)).toContain(burden);
    expect(detail(t, t.state, "10098")).toContain("He carries");
    expect(detail(t, t.state, "10168")).toContain("Thaurdir");
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  it("10187:A:3 offers each Undead enemy with 2 hit points or fewer left, any player's, each row naming whose it is", () => {
    const t = at({ seats: 2, attached: [{ code: "10187", to: "dh1" }], engaged: [{ code: "10100", seat: 0, damage: 2 }, { code: "10100", seat: 1, damage: 2 }] });
    const boon = idOf(t.state, "10187");
    const effects = t.ctx.effects.filter((effect) => effect.cardCode === "10187" && effect.timing === "response");
    const pushed = pushCardEffects({ ...t.state, window: null, mode: "stopped" }, "forced", boon, 0, false, effects, t.ctx, []);
    const asked = settle(pushed, t.ctx, []);
    const names: SheetNames = { card: (id) => (asked.cards[id]?.code === "10100" ? `Wight ${id}` : id), line: () => null };
    const sheet = sheetFor(asked, t.ctx, legalIntents(asked, t.ctx), names) as PickSheet | null;
    expect((sheet?.options ?? []).map((option) => option.label)).toHaveLength(2);
    expect((sheet?.options ?? []).every((option) => /Player [12]/.test(option.label))).toBe(true);
  });
});

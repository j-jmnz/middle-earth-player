// Rules: mec108.safe, mec108.objective-locations, mec108.campaign-setup-across-the-ettenmoors, mec108.side-quests-in-play, rr.guarded, rr.first-player (data/rules/entries.json); ledger lines 10068:A:1, 10070:A:1, 10077:A:2, 10080:A:1, 10182:A:3, 10183:A:2.
// What the table says of Across the Ettenmoors' pieces: the Losing Time clock on the campaign card (resources against 3, the copies set aside and what happens at 3, said true when none remain), a safe location and what it does while it is the active location, the treachery whose When Revealed it
// ignores, a guard drawn over the objective it guards wherever it was staged, No Rest on a hero, and the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard, withSeat, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { queueEvent } from "../../rules/windows/queue.ts";
import { guardWith } from "../../rules/families/objectives/guard.ts";
import { crowdedTable } from "../layout/crowded-table.ts";
import { tableLayout } from "../layout/layout.ts";
import { finish, idOf, legalIntents, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { CURRENT_QUEST_WORDS } from "../words/scenarios/angmar/angmar-table.ts";
import { dialProps } from "../readouts/dials.ts";
import { threatLevel } from "../readouts/threat-level.ts";
import { ettenmoorsDials, ignoredRevealNote } from "../readouts/ettenmoors.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "across-the-ettenmoors";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10064", phase: "Quest", ...layout });
const nameOf = (state: ScenarioState) => (id: string) => (state.cards[id]?.code ?? id).replace(/^10068$/, "Secluded Cave").replace(/^10069$/, "The Hoarwell").replace(/^10081$/, "Lie Low").replace(/^10077$/, "Troll-fells").replace(/^10079$/, "Arador's Bane").replace(/^10080$/, "No Rest");
const codeName = (code: string) => ({ "10182": "Across the Ettenmoors", "10068": "Secluded Cave" })[code] ?? code;
const losing = (state: ScenarioState) => ettenmoorsDials(state, codeName)[0];
const setResources = (state: ScenarioState, resources: number): ScenarioState => updateCard(state, idOf(state, "10182"), { resources });

describe("the Losing Time clock on the campaign card", () => {
  const FIVE = ["10183", "10183", "10183", "10183", "10183"];

  it("10182:A:3 shows the resources against 3, warms at 2 while a Losing Time is set aside and says what the quest phase does", () => {
    const t = at({ campaign: true, setAside: FIVE });
    const dial = (resources: number) => losing(setResources(t.state, resources));
    expect(dial(0)).toMatchObject({ value: 0, limit: 3, warms: true, label: "Losing Time", testID: "angmar-losing" });
    expect(dial(0)?.warn).toBeUndefined();
    expect(dial(1)?.warn).toBeUndefined();
    expect(dial(0)?.note).toBe("0 of 3 resources on the campaign card. Each quest phase adds 1. At 3, they come off and a Losing Time is revealed. 5 copies are set aside.");
    expect(dial(2)?.warn).toEqual({ level: "near", words: "The next quest phase reveals a Losing Time: each player raises their threat by 3 or exhausts a hero. 5 copies are set aside." });
    expect(scenarioDials(setResources(t.state, 2), t.ctx, codeName).some((one) => one.id === "losing")).toBe(true);
  });

  it("10182:A:3 says the right number of copies set aside, one copy in the singular", () => {
    const t = at({ campaign: true, setAside: ["10183"] });
    expect(losing(setResources(t.state, 2))?.note).toContain("1 copy is set aside.");
    expect(losing(setResources(t.state, 2))?.warn?.words).toContain("1 copy is set aside.");
  });

  it("10182:A:3 says nothing more is revealed once no Losing Time is set aside: no warning, the resources stay", () => {
    const t = at({ campaign: true, setAside: [] });
    for (const resources of [2, 3, 4]) {
      const dial = losing(setResources(t.state, resources));
      expect(dial?.warn).toBeUndefined();
      expect(dial?.limit).toBeUndefined();
      expect(dial?.warms).toBeUndefined();
      expect(dial?.name).not.toContain("revealed at 3");
      expect(dial?.limitWords).toBe("no copy is set aside");
      expect(dial?.note).toBe(`${resources} resources on the campaign card. No Losing Time is set aside, so nothing more is revealed.`);
    }
  });

  it("10182:A:3 keeps the ring calm and the speech free of a limit at 3 and 4 resources with no copy set aside, and critical at 3 with one set aside", () => {
    const none = at({ campaign: true, setAside: [] });
    for (const resources of [3, 4]) {
      const props = dialProps(losing(setResources(none.state, resources))!);
      expect(props.elimination).toBe(false);
      expect(props.limit).toBeUndefined();
      expect(props.limitWords).toBe("no copy is set aside");
    }
    const live = dialProps(losing(setResources(at({ campaign: true, setAside: ["10183"] }).state, 3))!);
    expect(live.elimination).toBe(true);
    expect(threatLevel(3, live.limit)).toBe("critical");
  });

  it("10182:A:3 is drawn only in a campaign game: a standalone game has no campaign card and no clock", () => {
    expect(losing(at({ campaign: false }).state)).toBeUndefined();
  });

  it("10182:A:3 says the same clock in the campaign card's preview", () => {
    const t = at({ campaign: true, setAside: FIVE });
    expect(angmarDetail(t.state, t.ctx, idOf(t.state, "10182"), nameOf(t.state))).toBe(losing(t.state)?.note);
  });
});

describe("a safe location on the table", () => {
  it("10068:A:1 names what the active safe location does, and what travelling to a staged one does", () => {
    const active = at({ active: "10068", staging: ["10081", "10069"] });
    const detail = (state: ScenarioState, code: string) => angmarDetail(state, active.ctx, idOf(state, code), nameOf(state));
    expect(detail(active.state, "10068")).toBe("Safe. While it is the active location, enemies make no engagement checks. The When Revealed effects of treacheries are ignored. The text of encounter side quests is blank. It goes to the victory display at the end of the quest phase.");
    expect(detail(active.state, "10069")).toBe("Safe. When the players travel here, every engaged enemy returns to the staging area.");
    expect(detail(active.state, "10081")).toBe("Its text box is blank while Secluded Cave is the active location: its Forced, Response and constant effects do nothing.");
    const staged = at({ staging: ["10081", "10068"] });
    expect(angmarDetail(staged.state, staged.ctx, idOf(staged.state, "10081"), nameOf(staged.state))).toBeNull();
  });

  it("10068:A:1 announces a treachery whose When Revealed effects are ignored, and only while a safe location is active", () => {
    const quiet = at({ active: "10068", deck: ["f0"] });
    const run = revealFromTop(quiet.state, quiet.ctx, "10079", []);
    expect(ignoredRevealNote(run.state, run.id, nameOf(run.state))).toBe("Arador's Bane: its When Revealed effects are ignored while Secluded Cave is the active location.");
    const loud = at({ staging: ["10068"], deck: ["10073"] });
    const revealed = finish({ state: revealFromTop(loud.state, loud.ctx, "10079", []).state, steps: [] }, loud.ctx);
    expect(ignoredRevealNote(revealed.state, idOf(revealed.state, "10079"), nameOf(revealed.state))).toBeNull();
  });
});

describe("a safe location's preview follows where it lies", () => {
  it("10068:A:1 says the travel words only in the staging area, a short line in the victory display and nothing in a pile", () => {
    const t = at({ staging: ["10069"] });
    const id = idOf(t.state, "10069");
    const say = (zone: string) => angmarDetail(updateCard(t.state, id, { zone } as never), t.ctx, id, nameOf(t.state));
    expect(say("staging")).toBe("Safe. When the players travel here, every engaged enemy returns to the staging area.");
    expect(say("victory")).toBe("Safe. The players travelled here, and it lies in the victory display.");
    expect(say("encounterDiscard")).toBeNull();
    expect(say("encounterDeck")).toBeNull();
  });
});

describe("a card with two things to say says both", () => {
  it("10080:A:1 keeps No Rest on a hero the Campaign Log marks determined, and the current quest on a blanked side quest", () => {
    const t = at({ phase: "Refresh" });
    const run = resolveRecords(updateCard(t.state, t.hero2, { exhausted: true }), t.ctx, "10080", "whenRevealed");
    const logged = { ...run.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, angmar: { protectDamage: null, heroDamage: {}, determined: [run.state.cards[t.hero2]?.code ?? ""], stolen: [] } } } as ScenarioState;
    const says = angmarDetail(logged, t.ctx, t.hero2, () => "No Rest");
    expect(says).toContain("The Campaign Log marks this character determined");
    expect(says).toContain("No Rest: it cannot ready");
    const quiet = at({ active: "10068", staging: ["10081"] });
    const quest = idOf(quiet.state, "10081");
    const current = { ...quiet.state, modifiers: [...quiet.state.modifiers, { instanceId: quest, sourceId: quest, stat: "currentQuest", amount: 1, until: "endOfPhase" }] } as ScenarioState;
    const line = angmarDetail(current, quiet.ctx, quest, nameOf(current));
    expect(line).toContain("Its text box is blank while Secluded Cave is the active location");
    expect(line).toContain(CURRENT_QUEST_WORDS);
  });
});

describe("a guard over the objective it guards", () => {
  it("10077:A:2 says what guards a safe location and what the guard holds, in the previews of both", () => {
    const t = at({ staging: ["10068", "10077"] });
    const guarded = guardWith(t.state, idOf(t.state, "10077"), idOf(t.state, "10068"));
    const detail = (code: string) => angmarDetail(guarded, t.ctx, idOf(guarded, code), nameOf(guarded));
    expect(detail("10068")).toContain("Guarded by Troll-fells. The players cannot travel here until Troll-fells leaves play.");
    expect(detail("10077")).toBe("It guards Secluded Cave. When it leaves play, Secluded Cave returns to the staging area and the players may travel to it.");
  });

  it("10077:A:2 lays a guard over its objective in the staging row whichever was staged first (Troll-fells is staged before the location it searches for)", () => {
    const { views, piles } = crowdedTable();
    const [first, second] = views.staging.entries;
    const guard = { ...first!, card: { ...first!.card, guard: true as const, host: second!.card.id } };
    const host = { ...second!, card: { ...second!.card, guard: undefined } };
    const rest = views.staging.entries.slice(2);
    for (const order of [[guard, host, ...rest], [host, guard, ...rest]]) {
      const layout = tableLayout(591, 338, { ...views, staging: { ...views.staging, entries: order } }, piles, {});
      const over = layout.slots.find((slot) => slot.id === guard.card.id);
      const under = layout.slots.find((slot) => slot.id === host.card.id);
      expect(over?.x).toBeGreaterThan(under?.x ?? 0);
      expect(over?.x).toBeLessThan((under?.x ?? 0) + (under?.w ?? 0));
    }
  });
});

describe("No Rest on a hero", () => {
  it("10080:A:1 says what No Rest does on the hero that carries it and on the card itself", () => {
    const t = at({ phase: "Refresh" });
    const tired = updateCard(t.state, t.hero2, { exhausted: true });
    const run = resolveRecords(tired, t.ctx, "10080", "whenRevealed");
    const state = run.state;
    const rest = idOf(state, "10080");
    const detail = (id: string) => angmarDetail(state, t.ctx, id, (card) => (state.cards[card]?.code === "10080" ? "No Rest" : "Aragorn"));
    expect(state.cards[rest]?.host).toBe(t.hero2);
    expect(detail(rest)).toBe("On Aragorn: Aragorn cannot ready and collects no resources in the resource phase. It is discarded when the players travel to a safe location.");
    expect(detail(t.hero2)).toBe("No Rest: it cannot ready and collects no resources. No Rest is discarded when the players travel to a safe location.");
  });
});

describe("the rows that can destroy a character or eliminate a player warn", () => {
  const names = (state: ScenarioState): SheetNames => ({ card: (id) => (state.cards[id]?.code === "10067" ? "Amarthiúl" : (state.cards[id]?.code ?? id)), line: () => null });
  const opened = (t: ReturnType<typeof at>, code: string, timing: "forced" | "whenRevealed", state: ScenarioState = t.state): ScenarioState => {
    const spawned = spawn(state, code, { zone: "staging" });
    const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
    const pushed = pushCardEffects(spawned.state, timing, spawned.id, 0, false, effects, t.ctx, []);
    return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
  };
  const sheetOf = (t: ReturnType<typeof at>, state: ScenarioState) => sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state)) as PickSheet;

  it("10073:A:1 warns on a character that one more damage destroys, and says the game is lost for Amarthiúl", () => {
    const t = at({ play: ["10067"] });
    const worn = updateCard(updateCard(t.state, t.hero, { damage: 5 }), idOf(t.state, "10067"), { damage: 2 });
    const cautions = Object.fromEntries(sheetOf(t, opened(t, "10073", "forced", worn)).options.map((option) => [option.label, option.caution]));
    expect(cautions).toEqual({ dh1: "Tap again: dh1 is destroyed", dh2: undefined, Amarthiúl: "Tap again: Amarthiúl is destroyed and the game is lost" });
    const fresh = Object.values(sheetOf(t, opened(t, "10073", "forced")).options).map((option) => option.caution);
    expect(fresh.every((caution) => caution === undefined)).toBe(true);
  });

  it("10183:A:2 warns before a raise of 3 that takes a player to 50, from 47 up", () => {
    const t = at();
    const at47 = (threat: number): ScenarioState => withSeat(t.state, 0, { ...t.state.seats[0]!, threat });
    const raise = (threat: number) => sheetOf(t, opened(t, "10183", "whenRevealed", at47(threat))).options.find((option) => option.label === "Raise your threat by 3")?.caution;
    expect(raise(47)).toBe("Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost");
    expect(raise(46)).toBeUndefined();
  });

  it("10078:A:1 names the ally that entered play on both rows and warns when the damage destroys it", () => {
    const t = at({ staging: ["10078"], play: ["ally"] });
    const ally = idOf(t.state, "ally");
    const ask = (state: ScenarioState) => settle({ ...queueEvent(state, { trigger: "enteredPlay", seat: 0, cardId: ally }), window: null, mode: "stopped" }, t.ctx, []);
    const rows = (state: ScenarioState) => sheetOf(t, ask(state)).options.map((option) => [option.label, option.caution]);
    expect(rows(t.state)).toEqual([["Exhaust ally", undefined], ["Deal ally 1 damage", undefined]]);
    expect(rows(updateCard(t.state, ally, { damage: 9 }))).toEqual([["Exhaust ally", undefined], ["Deal ally 1 damage", "Tap again: the damage destroys ally"]]);
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  it("10080:A:1 offers the first player each exhausted hero, any player's, each row naming whose it is", () => {
    const t = at({ seats: 2, phase: "Refresh", deck: ["10080"] });
    const seat1 = t.state.seats[1]?.heroes[0] ?? "";
    const tired = updateCard(updateCard(t.state, t.hero, { exhausted: true }), seat1, { exhausted: true });
    // The scenario's games hold the side quest rules (the golden's opening checks it): the rows of a pick that spans seats read as they do in the earlier Angmar scenarios.
    const run = revealFromTop({ ...tired, sideQuests: true }, t.ctx, "10080", []);
    const names: SheetNames = { card: (id) => (run.state.cards[id]?.code === "10080" ? "No Rest" : `Hero ${id}`), line: () => null };
    const sheet = sheetFor(run.state, t.ctx, legalIntents(run.state, t.ctx), names) as PickSheet | null;
    expect((sheet?.options ?? []).map((option) => option.label)).toEqual([`Hero ${t.hero} · Player 1's hero`, `Hero ${seat1} · Player 2's hero`]);
  });
});

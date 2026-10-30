// Rules: rr.setup, rr.forced, rr.reveal, rr.step-6-4-2, rr.attachment-cards, rr.refresh-phase (data/rules/entries.json). What the nightmare
// family adds for the Mirkwood Paths Nightmare decks, run with their real records (src/effects/authored/nightmare/) on fixture cards under
// their codes. Each test names the ledger line (data/printed/nightmare.json) it is for.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as MIRKWOOD } from "../../effects/authored/nightmare/passage-through-mirkwood.ts";

import { syncConstants } from "../constants.ts";
import { pushCardEffects } from "../effect-frames.ts";
import { cardMap, expectOk, hero, idleScenario } from "../fixture.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { modifiedStat } from "../keywords.ts";
import { settle } from "../machine.ts";
import { readyCard } from "../player-verbs.ts";
import { reduce } from "../reduce.ts";
import { definePrinted } from "../printed.ts";
import { doRefresh } from "../refresh.ts";
import { finishSetup } from "../setup.ts";
import { updateCard, withThreat, type ScenarioState } from "../state.ts";
import { spawn } from "../zones.ts";
import { run as runNightmare } from "./nightmare.ts";

const cards = cardMap([
  definePrinted({ code: "900101", name: "Passage Through Mirkwood Nightmare", type: "nightmare" }),
  definePrinted({ code: "900102", name: "Ungoliant's Spawn", type: "enemy", traits: ["Creature", "Spider"], engagementCost: 32, threat: 3, attack: 5, defense: 3, health: 9 }),
  definePrinted({ code: "900103", name: "Ungoliant's Brood", type: "enemy", traits: ["Creature", "Spider"], engagementCost: 31, threat: 2, attack: 3, defense: 2, health: 5 }),
  definePrinted({ code: "900105", name: "Spiders of Mirkwood", type: "enemy", traits: ["Spider"], engagementCost: 18, threat: 3, attack: 2, defense: 2, health: 4 }),
  definePrinted({ code: "900106", name: "The Spider's Web", type: "treachery" }),
  definePrinted({ code: "900107", name: "Backtrack!", type: "treachery" }),
  definePrinted({ code: "900109", name: "Glade of the Spawn", type: "location", traits: ["Mirkwood"], threat: 4, questPoints: 4 }),
  definePrinted({ code: "rider", name: "Rider", type: "enemy", threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  definePrinted({ code: "road", name: "Road", type: "location", threat: 1, questPoints: 2 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "stage", name: "Flies and Spiders", type: "quest", questPoints: 8 }),
  hero("frodo", "spirit", 8, 2),
  hero("sam", "spirit", 8, 2),
  hero("gimli", "tactics", 8, 3),
]);

function record(effects: readonly Effect[], id: string): Effect {
  const found = effects.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

// One seat (or two) with three ready heroes each, and the quest stage in play.
function table(seatCount: 1 | 2 = 1): { state: ScenarioState; heroes: string[][] } {
  let state: ScenarioState = { ...idleScenario(seatCount), stages: [{ code: "stage" }], firstPlayer: 0 };
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  const heroes: string[][] = [];
  for (let seat = 0; seat < seatCount; seat += 1) {
    const own: string[] = [];
    for (const code of ["frodo", "sam", "gimli"]) {
      const made = spawn(state, code, { zone: "heroes", seat });
      state = made.state;
      own.push(made.id);
    }
    heroes.push(own);
  }
  return { state, heroes };
}

function deck(state: ScenarioState, codes: readonly string[], zone: "encounterDeck" | "encounterDiscard" = "encounterDeck"): ScenarioState {
  let next = state;
  for (const code of codes) next = spawn(next, code, { zone }).state;
  return next;
}

describe("Passage Through Mirkwood Nightmare (900101-900109)", () => {
  const ctx: ReduceContext = { effects: MIRKWOOD, cards };
  const choose = (state: ScenarioState, optionId: string): ScenarioState => expectOk(reduce(state, { type: "Choose", optionId }, ctx)).state;
  const fire = (state: ScenarioState, frame: "whenRevealed" | "forced" | "shadow", sourceId: string, id: string, steps: EngineStep[] = []) =>
    settle(pushCardEffects(state, frame, sourceId, 0, false, [record(MIRKWOOD, id)], ctx, steps), ctx, steps);

  it("has each player reveal a card during Setup, from the setup card next to the quest deck (900101:A:2, duringSetup)", () => {
    const { state: base } = table(2);
    const placed = spawn(deck(base, ["rider", "road", "rider"]), "900101", { zone: "nightmare" }).state;
    const done = settle({ ...finishSetup({ ...placed, phase: "Setup", setup: [] }, ctx, []), mode: "stopped" }, ctx, []);
    expect(done.staging.map((id) => done.cards[id]?.code)).toEqual(["rider", "road"]);
    expect(done.encounterDeck).toHaveLength(1);
    // Without the setup card nothing is revealed.
    const normal = settle({ ...finishSetup({ ...deck(base, ["rider", "road"]), phase: "Setup", setup: [] }, ctx, []), mode: "stopped" }, ctx, []);
    expect(normal.staging).toEqual([]);
  });

  it("discards each committed character Ungoliant's Spawn leaves at 0 Willpower (900102:A:1)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = "", gimli = ""] = heroes[0] ?? [];
    let state = updateCard(updateCard(base, frodo, { committed: true, exhausted: true }), gimli, { committed: true, exhausted: true });
    const spawned = spawn(state, "900102", { zone: "staging" });
    state = fire(spawned.state, "whenRevealed", spawned.id, "900102:whenRevealed:1");
    expect(state.cards[frodo]?.zone).toBe("discard");
    expect(state.cards[gimli]?.zone).toBe("heroes");
    expect(state.cards[sam]?.zone).toBe("heroes");
    const gimliCard = state.cards[gimli];
    expect(gimliCard ? modifiedStat(state, gimliCard, "willpower", cards) : -1).toBe(1);
  });

  it("keeps the engaged player's cards from readying for the rest of the round once Ungoliant's Brood engages (900103:A:1, cannotReady)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = ""] = heroes[0] ?? [];
    const brood = spawn(updateCard(updateCard(base, frodo, { exhausted: true }), sam, { exhausted: true }), "900103", { zone: "engaged", seat: 0 });
    const barred = fire(brood.state, "forced", brood.id, "900103:forced:1");
    expect(readyCard(barred, frodo).cards[frodo]?.exhausted).toBe(true);
    const refreshed = doRefresh(barred, ctx, []);
    expect(refreshed.cards[frodo]?.exhausted).toBe(true);
    expect(refreshed.cards[sam]?.exhausted).toBe(true);
    // Before it engages, they ready.
    expect(readyCard(brood.state, frodo).cards[frodo]?.exhausted).toBe(false);
  });

  it("gives Spiders of Mirkwood +1 Attack for each exhausted character of the player it is engaged with (900105:A:1)", () => {
    const { state: base, heroes } = table();
    const [frodo = "", sam = ""] = heroes[0] ?? [];
    const engaged = spawn(updateCard(updateCard(base, frodo, { exhausted: true }), sam, { exhausted: true }), "900105", { zone: "engaged", seat: 0 });
    const synced = syncConstants(engaged.state, ctx);
    const spider = synced.cards[engaged.id];
    expect(spider ? modifiedStat(synced, spider, "attack", cards) : 0).toBe(4);
    const staged = spawn(engaged.state, "900105", { zone: "staging" });
    const quiet = syncConstants(staged.state, ctx);
    const other = quiet.cards[staged.id];
    expect(other ? modifiedStat(quiet, other, "attack", cards) : 0).toBe(2);
  });

  it("attaches The Spider's Web to a hero of the player with the highest threat, who exhausts each hero; each ready deals 1 damage (900106:A:1)", () => {
    const { state: base, heroes } = table(2);
    const high = withThreat(base, 1, 40);
    const web = spawn(high, "900106", { zone: "staging" });
    const asked = fire(web.state, "whenRevealed", web.id, "900106:whenRevealed:1");
    const attached = choose(asked, heroes[1]?.[2] ?? "");
    const host = attached.cards[web.id]?.host ?? "";
    expect(host).toBe(heroes[1]?.[2]);
    for (const id of heroes[1] ?? []) expect(attached.cards[id]?.exhausted).toBe(true);
    for (const id of heroes[0] ?? []) expect(attached.cards[id]?.exhausted).toBe(false);
    const readied = settle(readyCard(syncConstants(attached, ctx), host), ctx, []);
    expect(readied.cards[host]?.damage).toBe(1);
    const other = (heroes[1] ?? []).find((id) => id !== host) ?? "";
    expect(settle(readyCard(readied, other), ctx, []).cards[other]?.damage).toBe(0);
  });

  it("returns the topmost enemy or location in the encounter discard pile to the staging area (900107:A:2)", () => {
    const { state: base } = table();
    const piled = deck(base, ["rider", "road", "mist"], "encounterDiscard");
    const back = spawn(piled, "900107", { zone: "staging" });
    const done = fire(back.state, "whenRevealed", back.id, "900107:whenRevealed:1");
    expect(done.staging.map((id) => done.cards[id]?.code)).toContain("road");
    expect(done.encounterDiscard.map((id) => done.cards[id]?.code)).toEqual(["rider", "mist"]);
  });

  it("deals the attacking enemy the topmost card with a Shadow effect in the encounter discard pile (900107:A:3)", () => {
    const { state: base } = table();
    const enemy = spawn(deck(base, ["900102", "mist"], "encounterDiscard"), "rider", { zone: "engaged", seat: 0 });
    const attacking = { ...enemy.state, pendingAttack: { enemyId: enemy.id, seat: 0 } };
    const dealt = runNightmare(attacking, { verb: "DealShadowFromDiscard" }, { seat: 0, sourceId: null }, ctx, []);
    const spawnCard = Object.values(dealt?.cards ?? {}).find((card) => card.code === "900102");
    expect(spawnCard?.zone).toBe("shadow");
    expect(dealt?.encounterDiscard.map((id) => dealt.cards[id]?.code)).toEqual(["mist"]);
  });

  it("has each player exhaust a character when a Spider enters play while Glade of the Spawn is the active location (900109:A:1)", () => {
    const { state: base, heroes } = table();
    const glade = spawn(base, "900109", { zone: "activeLocation" });
    const spider = spawn(glade.state, "900105", { zone: "staging" });
    const asked = settle({ ...spider.state, pendingEvents: [{ trigger: "encounterEnteredPlay", seat: null, subject: spider.id }] }, ctx, []);
    const heard = choose(asked, heroes[0]?.[1] ?? "");
    expect((heroes[0] ?? []).filter((id) => heard.cards[id]?.exhausted)).toHaveLength(1);
  });
});

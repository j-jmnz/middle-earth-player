// Rules: rr.quest-phase, rr.active-location, rr.action, rr.limits, rr.triggered-ability, rr.restricted, rr.enters-play, rr.in-play-and-out-of-play,
// rr.step-4-2, rr.travel, rr.attachment-cards, rr.surge, rr.encounter-deck (data/rules/entries.json).
// Roam Across Rhovanion heroes, allies and its event, each printed line tested from the words on the card (lineSpec,
// test/harness/line-spec.ts): Haldan 19026:A:1, Wiglaf 19027:A:2, Meneldor 19031:A:1 and A:2, Wild Stallion 19033:A:1, South Away!
// 19034:A:1, Eagle of the North 19035:A:1 and A:2. The lines are the text of data/cards/RAR.json (data/printed holds no ledger for this
// pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { setAsideEncounterCards } from "../../rules/families/sidequests/encounter.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, play, playerTable, questing, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const HALDAN = "19026";
const WIGLAF = "19027";
const PATH = "19030";
const MENELDOR = "19031";
const STALLION = "19033";
const SOUTH = "19034";
const EAGLE = "19035";
// Core Aragorn (Leadership), Gimli (Tactics), Éowyn (Spirit), Denethor (Lore).
const ARAGORN = "01001";
const GIMLI = "01004";
const EOWYN = "01007";
const DENETHOR = "01010";
// Round Shield: "Attach to a character. Restricted." (Tactics).
const SHIELD = "19118";
// Caught in a Web: an encounter card that is an attachment once in play.
const WEB = "01080";
const GLADE = "glade";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [HALDAN, WIGLAF, PATH, MENELDOR, STALLION, SOUTH, EAGLE, ARAGORN, GIMLI, EOWYN, DENETHOR, SHIELD, WEB];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  // A location with no Travel effect.
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 5 }));
  base = { ...starter, cards };
});

// The table with `cardId` attached to `hostId` and the constants brought up to date.
function attached(tab: Table, cardId: string, hostId: string, state: ScenarioState = tab.state): ScenarioState {
  return syncConstants(attachTo(state, cardId, hostId), tab.ctx);
}

describe("Haldan (19026:A:1)", () => {
  // "While the active location has an attachment on it, Haldan does not exhaust to quest.": Woodmen's Path is played on the active location
  // through the intent; Haldan then commits and stays ready.
  lineSpec("19026:A:1", "Haldan: does not exhaust to quest while the active location has an attachment", (effects) => {
    const tab = table(effects, { heroes: [{ code: HALDAN, seat: 0 }], hand: [{ code: PATH, seat: 0 }], active: GLADE, deck: ["f0", "f0"] });
    const haldan = idsOf(tab, HALDAN);
    const played = play(begin(tab.state), tab, idsOf(tab, PATH), idsOf(tab, GLADE));
    expect(played.state.cards[idsOf(tab, PATH)]?.host).toBe(idsOf(tab, GLADE));
    const run = sendUnledgered(begin(questing(played.state)), { type: "Commit", cardIds: [haldan] }, tab.ctx);
    expect(run.state.cards[haldan]).toMatchObject({ committed: true, exhausted: false });
  });

  // With no attachment on the active location he exhausts to quest.
  it("19026:A:1 Haldan: exhausts to quest while the active location has no attachment", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: HALDAN, seat: 0 }], active: GLADE, deck: ["f0", "f0"] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, HALDAN)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, HALDAN)]?.exhausted).toBe(true);
  });
});

describe("Wiglaf (19027:A:2)", () => {
  // Wiglaf is exhausted and holds two ready attachments.
  function wiglafTable(effects: readonly Effect[]): { tab: Table; first: string; second: string } {
    const scene = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: WIGLAF, seat: 0 }, { code: PLAIN, seat: 0 }, { code: PLAIN, seat: 0 }] });
    const wiglaf = idsOf(scene, WIGLAF);
    const [first, second] = scene.ids[PLAIN] ?? [];
    const state = updateCard(attached(scene, second ?? "", wiglaf, attached(scene, first ?? "", wiglaf)), wiglaf, { exhausted: true });
    return { tab: { ...scene, state }, first: first ?? "", second: second ?? "" };
  }

  // "Action: Exhaust an attachment on Wiglaf to ready him. (Limit once per phase.)": an attachment is exhausted and Wiglaf readied; once
  // he is exhausted again the Action is not offered in the same phase, and it is in the next.
  lineSpec("19027:A:2", "Wiglaf: exhaust an attachment on him to ready him, once per phase", (effects) => {
    const { tab, first, second } = wiglafTable(effects);
    const wiglaf = idsOf(tab, WIGLAF);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: wiglaf, effectId: "19027:action:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
      run = sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx);
    }
    expect(run.state.cards[wiglaf]?.exhausted).toBe(false);
    expect([run.state.cards[first]?.exhausted, run.state.cards[second]?.exhausted]).toEqual([true, false]);
    const again = updateCard(run.state, wiglaf, { exhausted: true });
    expect(triggers(again, tab)).not.toContain("19027:action:1");
    expect(triggers({ ...withMode(again, "questCommit"), phase: "Quest", boundaryPhase: "Quest", window: { kind: "pass" } }, tab)).toContain("19027:action:1");
  });

  // Ready, or with every attachment on him exhausted, the Action would do nothing in full: it is not offered (rr.triggered-ability).
  it("19027:A:2 Wiglaf: not offered while he is ready, or with no ready attachment on him", () => {
    const { tab, first, second } = wiglafTable(EFFECTS);
    const wiglaf = idsOf(tab, WIGLAF);
    expect(triggers(updateCard(tab.state, wiglaf, { exhausted: false }), tab)).not.toContain("19027:action:1");
    const spent = updateCard(updateCard(tab.state, first, { exhausted: true }), second, { exhausted: true });
    expect(triggers(spent, tab)).not.toContain("19027:action:1");
  });
});

describe("Meneldor (19031:A:1, A:2)", () => {
  // "Cannot have restricted attachments."
  lineSpec("19031:A:1", "Meneldor: a restricted attachment cannot go on him; it can on another character", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: MENELDOR, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    const pay = payFor(tab.state, tab.ctx, shield);
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, MENELDOR), payments: pay }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, GIMLI), payments: pay }, tab.ctx)).toBeNull();
  });

  // "Response: After Meneldor enters or leaves play, place 2 progress on a location.": played from the hand, he places 2 progress on the
  // chosen Glade in the staging area (the active one is a choice too).
  lineSpec("19031:A:2", "Meneldor: after he enters play, place 2 progress on a location", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: MENELDOR, seat: 0 }], staging: [GLADE], active: GLADE });
    const [staged, active] = tab.ids[GLADE] ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, MENELDOR));
    expect(triggers(run.state, tab)).toContain("19031:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MENELDOR), effectId: "19031:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([staged ?? "", active ?? ""].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged ?? "" }, tab.ctx);
    expect(run.state.cards[staged ?? ""]?.progress).toBe(2);
    expect(run.state.cards[active ?? ""]?.progress).toBe(0);
  });

  // Destroyed by damage, he leaves play: 2 progress on the active location.
  lineSpec("19031:A:2", "Meneldor: after he leaves play, place 2 progress on a location", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: MENELDOR, seat: 0 }], active: GLADE });
    const meneldor = idsOf(tab, MENELDOR);
    let run = sendUnledgered(begin(placeDamage(tab.state, meneldor, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[meneldor]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("19031:response:2");
    run = sendUnledgered(run, { type: "Trigger", cardId: meneldor, effectId: "19031:response:2" }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, GLADE) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GLADE)]?.progress).toBe(2);
  });

  // With no location in play there is nowhere for the progress: no Response.
  it("19031:A:2 Meneldor: not offered with no location in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: MENELDOR, seat: 0 }] });
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, MENELDOR)).state, tab)).not.toContain("19031:response:1");
  });
});

describe("Wild Stallion (19033:A:1)", () => {
  // "Cannot have attachments": Round Shield ("Attach to a character.") cannot go on him; it can on Gimli.
  lineSpec("19033:A:1", "Wild Stallion: cannot have attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: STALLION, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    const pay = payFor(tab.state, tab.ctx, shield);
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, STALLION), payments: pay }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, GIMLI), payments: pay }, tab.ctx)).toBeNull();
  });
});

describe("South Away! (19034:A:1)", () => {
  // The travel phase of a two-player game: in the staging area a Glade with Woodmen's Path and Caught in a Web (an encounter attachment), a
  // Glade with only Caught in a Web, and a bare Glade; another Glade is active.
  function southTable(effects: readonly Effect[]): { tab: Table; chosen: string; webbed: string; bare: string; active: string } {
    const scene = table(effects, { seats: 2, start: "travel", heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: PATH, seat: 0 }], hand: [{ code: SOUTH, seat: 0 }], staging: [GLADE, GLADE, GLADE], active: GLADE });
    const [chosen, webbed, bare, active] = scene.ids[GLADE] ?? [];
    let state = attachTo(scene.state, idsOf(scene, PATH), chosen ?? "");
    for (const host of [chosen, webbed]) {
      const made = spawn(state, WEB, { zone: "attached" });
      state = attachTo(updateCard(made.state, made.id, { face: "up", controller: null }), made.id, host ?? "");
    }
    return { tab: { ...scene, state: syncConstants(state, scene.ctx) }, chosen: chosen ?? "", webbed: webbed ?? "", bare: bare ?? "", active: active ?? "" };
  }

  // "Travel Action: Choose a location in the staging area with a player card attachment and make it the active location, returning any
  // previous active location to the staging area. Reduce each player's threat by X, where X is the number of attachments on the active
  // location.": only the Glade with Woodmen's Path is a choice; it becomes active, the old one returns to the staging area, and each
  // player's threat falls by 2 (Woodmen's Path and Caught in a Web).
  lineSpec("19034:A:1", "South Away!: the chosen location with a player card attachment becomes active; each player's threat falls by its attachments", (effects) => {
    const { tab, chosen, active } = southTable(effects);
    // The travel step is passed by (an active location is in play): the Travel phase's action window (4.2) opens.
    const declined = sendUnledgered(begin(tab.state), { type: "DeclineTravel" }, tab.ctx);
    expect(declined.state.phase).toBe("Travel");
    let run = play(declined, tab, idsOf(tab, SOUTH));
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).toEqual([chosen]);
      run = sendUnledgered(run, { type: "Choose", optionId: chosen }, tab.ctx);
    }
    expect(run.state.cards[chosen]?.zone).toBe("activeLocation");
    expect(run.state.cards[active]?.zone).toBe("staging");
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([8 - 2, 6 - 2]);
  });

  // A Travel Action: not playable in the planning phase.
  it("19034:A:1 South Away!: not playable outside the travel phase", () => {
    const { tab } = southTable(EFFECTS);
    const planning = { ...withMode(tab.state, "planning"), phase: "Planning" as const, boundaryPhase: "Planning" as const, window: { kind: "pass" as const } };
    expect(refusal(planning, { type: "PlayCard", cardId: idsOf(tab, SOUTH), payments: [] }, tab.ctx)).not.toBeNull();
  });
});

describe("Eagle of the North (19035:A:1, A:2)", () => {
  // "Encounter.": at the start of the game the Eagle is set aside from the player's deck, still that player's card; the other card stays.
  lineSpec("19035:A:1", "Eagle of the North: Encounter, set aside from the player's deck", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], playerDeck: [{ code: EAGLE, seat: 0 }, { code: "card", seat: 0 }] });
    const state = setAsideEncounterCards(tab.state, 0, tab.ctx);
    expect(state.cards[idsOf(tab, EAGLE)]?.zone).toBe("setAside");
    expect(state.cards[idsOf(tab, "card")]?.zone).toBe("deck");
  });

  // "Cannot have restricted attachments."
  lineSpec("19035:A:2", "Eagle of the North: a restricted attachment cannot go on it; it can on another character", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: EAGLE, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    const pay = payFor(tab.state, tab.ctx, shield);
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, EAGLE), payments: pay }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: shield, hostId: idsOf(tab, GIMLI), payments: pay }, tab.ctx)).toBeNull();
  });

  // "Surge." (the printed keyword): revealed from the encounter deck in the staging step, the Eagle makes the next card be revealed too.
  it("19035:A:1 Eagle of the North: Surge, revealed from the encounter deck", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], deck: [EAGLE, GLADE, GLADE] });
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    for (let guard = 0; guard < 10 && run.state.window?.kind === "choose"; guard += 1) run = sendUnledgered(run, { type: "Choose", optionId: choices(run.state, tab)[0] ?? "" }, tab.ctx);
    const [first, second] = tab.ids[GLADE] ?? [];
    expect(run.state.cards[idsOf(tab, EAGLE)]?.zone).not.toBe("encounterDeck");
    expect(run.state.cards[first ?? ""]?.zone).toBe("staging");
    expect(run.state.cards[second ?? ""]?.zone).toBe("encounterDeck");
  });
});

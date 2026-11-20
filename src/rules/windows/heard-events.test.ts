// Rules: rr.triggering-condition, rr.in-play-and-out-of-play, rr.enters-play, rr.ownership-and-control, rr.first-player (data/rules/entries.json).
// Each way a card readies, is healed, is discarded, leaves or enters play, or a threat or a pool grows, announces the event the cards that hear it
// listen for, whatever verb made it happen.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { syncConstants } from "../interpret/constants.ts";
import { runInstruction } from "../interpret/interpret.ts";
import { updateCard, type ScenarioState } from "../core/state.ts";
import { moveCard } from "../core/zones.ts";
import { moveEncounter } from "../families/encounter/moves.ts";
import { passHand } from "../families/erech/hand.ts";
import { captureAlly } from "../families/captured/pile.ts";
import { flipSecret } from "../families/island/cards.ts";
import { answeringController } from "./listen.ts";
import { fund, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { buildTable, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";

const ARAGORN = "01001";
const GIMLI = "01004";
const COURAGE = "01057";
const GUIDE = "01044";
const WEATHER_HILLS = "141049";
const SIGNS_OF_GOLLUM = "02014";
const LORE = "01061";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([ARAGORN, GIMLI, COURAGE, GUIDE, WEATHER_HILLS, SIGNS_OF_GOLLUM, LORE]))]) };
});

function table(scene: Scene): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene });
  return { ...tab, state: syncConstants(fund(tab.state, 0, 6), tab.ctx) };
}

function runAs(tab: Table, state: ScenarioState, instruction: Instruction, sourceId: string | null): ScenarioState {
  return runInstruction(state, instruction, { seat: 0, sourceId }, tab.ctx, []);
}

const heard = (state: ScenarioState, trigger: string): string[] => (state.pendingEvents ?? []).filter((event) => event.trigger === trigger).map((event) => event.cardId ?? event.subject ?? "");

describe("readied", () => {
  it("a card effect that readies the host announces it (Unexpected Courage, 01057:A:2)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], attached: [{ code: COURAGE, host: ARAGORN }] });
    const aragorn = idsOf(tab, ARAGORN);
    const state = runAs(tab, updateCard(tab.state, aragorn, { exhausted: true }), { verb: "Ready", target: "host" }, idsOf(tab, COURAGE));
    expect(state.cards[aragorn]?.exhausted).toBe(false);
    expect(heard(state, "readied")).toEqual([aragorn]);
  });

  it("readying every character announces each exhausted one (Grim Resolve, 01025:A:1)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }] });
    const [aragorn, gimli] = [idsOf(tab, ARAGORN), idsOf(tab, GIMLI)];
    const state = runAs(tab, updateCard(tab.state, aragorn, { exhausted: true }), { verb: "Ready", target: "allCharacters" }, aragorn);
    expect(heard(state, "readied")).toEqual([aragorn]);
    expect(state.cards[gimli]?.exhausted).toBe(false);
  });
});

describe("discarded from the hand", () => {
  it("the only player's hand discarded by Groping Horror announces each card (50324:A:1)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: GUIDE, seat: 0 }, { code: COURAGE, seat: 0 }] });
    const state = passHand(tab.state);
    expect(state.seats[0]?.hand).toEqual([]);
    expect(heard(state, "discardedFromHand").sort()).toEqual([idsOf(tab, GUIDE), idsOf(tab, COURAGE)].sort());
  });
});

describe("threat raised", () => {
  it("raising a threat to a value announces the raise (Southern Gate, 10042:A:3; Sam Gamgee, 12035:A:2)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }] });
    const state = runAs(tab, tab.state, { verb: "RaiseThreatTo", amount: 35 }, null);
    expect(state.seats[0]?.threat).toBe(35);
    expect((state.pendingEvents ?? []).some((event) => event.trigger === "threatRaised" && event.seat === 0)).toBe(true);
  });
});

describe("resources moved", () => {
  it("a resource moved to a hero's pool announces that the hero gains it (Errand-rider; Heir of Mardil, 08113:A:2)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }] });
    const [aragorn, gimli] = [idsOf(tab, ARAGORN), idsOf(tab, GIMLI)];
    const state = runAs(tab, picking(tab.state, aragorn, [aragorn, gimli]), { verb: "MoveResources", amount: 1 }, aragorn);
    expect(state.cards[gimli]?.resources).toBe((tab.state.cards[gimli]?.resources ?? 0) + 1);
    expect(heard(state, "resourcesMoved")).toEqual([gimli]);
    expect(heard(state, "resourcesAdded")).toEqual([]);
  });
});

describe("an encounter card leaves play", () => {
  it("an active location discarded by a card effect announces it left play (Weather Hills, 141049:A:2)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], active: WEATHER_HILLS });
    const hills = idsOf(tab, WEATHER_HILLS);
    const state = moveEncounter(tab.state, hills, "discard", 0, tab.ctx, []);
    expect(state.cards[hills]?.zone).toBe("encounterDiscard");
    expect(heard(state, "leftPlay")).toEqual([hills]);
  });
});

describe("whose abilities an encounter card in the staging area has", () => {
  it("the first player's, whoever revealed it (Signs of Gollum, 02014:A:1)", () => {
    const tab = table({ seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 1 }], staging: [SIGNS_OF_GOLLUM] });
    const signs = idsOf(tab, SIGNS_OF_GOLLUM);
    const revealed = updateCard(tab.state, signs, { controller: 1 });
    expect(answeringController(revealed.cards[signs]!, tab.ctx)).toBeNull();
    // A player card keeps its controller.
    const ally = moveCard(tab.state, idsOf(tab, GIMLI), { zone: "heroes", seat: 1 });
    expect(answeringController(ally.cards[idsOf(tab, GIMLI)]!, tab.ctx)).toBe(1);
  });
});

// A frame of a running effect that has picked these cards, in order.
function picking(state: ScenarioState, sourceId: string, picked: string[]): ScenarioState {
  return { ...state, stack: [{ frame: "ResolveEffect", cardId: sourceId, seat: 0, step: 0, peril: false, data: { kind: "effect", picked } }] } as unknown as ScenarioState;
}

describe("discarded from the deck", () => {
  it("each copy The Sky Darkens discards from the deck is announced (10136:A:1; Hidden Cache, 06143:A:1)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], playerDeck: [{ code: GUIDE, seat: 0 }, { code: COURAGE, seat: 0 }], hand: [{ code: GUIDE, seat: 0 }] });
    const [inHand, inDeck] = [tab.ids[GUIDE]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "", tab.ids[GUIDE]?.find((id) => tab.state.cards[id]?.zone === "deck") ?? ""];
    const discarded = moveCard(tab.state, inHand, { zone: "discard", seat: 0 });
    const state = runAs(tab, picking(discarded, idsOf(tab, ARAGORN), [inHand]), { verb: "DiscardCopiesFromDeck", of: "picked", all: true }, idsOf(tab, ARAGORN));
    expect(state.cards[inDeck]?.zone).toBe("discard");
    expect(heard(state, "discardedFromDeck")).toEqual([inDeck]);
  });
});

describe("an ally leaves play", () => {
  it("an ally removed from the game is announced (Radagast's Request, 02061:B:2; Valiant Sacrifice, 01024:A:1)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }] });
    const guide = idsOf(tab, GUIDE);
    const state = runAs(tab, tab.state, { verb: "RemoveFromGame", self: true }, guide);
    expect(state.cards[guide]?.zone).toBe("removed");
    expect(heard(state, "allyLeftPlay")).toEqual([guide]);
  });

  it("an ally captured underneath an enemy is announced (Cruel Torturer, 10043:A:2)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }], staging: [WEATHER_HILLS] });
    const guide = idsOf(tab, GUIDE);
    const state = captureAlly(tab.state, guide, idsOf(tab, WEATHER_HILLS));
    expect(state.cards[guide]?.zone).toBe("captured");
    expect(heard(state, "allyLeftPlay")).toEqual([guide]);
  });
});

describe("an ally enters play", () => {
  it("a secret ally flipped under the active location enters play, announced (Temple of the Deceived, 11197:A:3)", () => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: GUIDE, seat: 0 }], active: WEATHER_HILLS });
    const guide = idsOf(tab, GUIDE);
    const under = updateCard(moveCard(tab.state, guide, { zone: "under", locationId: idsOf(tab, WEATHER_HILLS) }), guide, { face: "down", controller: null });
    const state = flipSecret(under, { seat: 0, sourceId: null }, tab.ctx, []);
    expect(state.cards[guide]?.zone).toBe("play");
    expect(heard(state, "enteredPlay")).toEqual([guide]);
  });
});

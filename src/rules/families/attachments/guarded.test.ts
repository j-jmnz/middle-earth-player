// Rules: wor.guarded-x, rr.guarded, rr.staging, rr.attachment-cards, rr.in-play-and-out-of-play, rr.destroy, rr.search
// (data/rules/entries.json). Guarded (X) on a player attachment (wor.guarded-x): encounter cards are discarded until one of the type
// is discarded, that card is added to the staging area and guards the attachment, which cannot be attached until it is free of
// encounters, when its owner puts it into play (the one PutIntoPlay path, played or put into play by an effect). Real records with
// fixture cards.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";

import { legalTargets } from "../../engine/legal.ts";
import { settle } from "../../engine/machine.ts";
import { reduce } from "../../engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { attachmentCtx, deck, offered, play, put, seat, send } from "./fixture.ts";

const ctx = attachmentCtx(EFFECTS);

// Combat damage the first hero deals to an engaged enemy, in a player attack window.
function attack(state: ScenarioState, enemyId: string, attackerId: string): ScenarioState {
  const window: ScenarioState = { ...state, phase: "Combat", mode: "playerAttacks", boundaryPhase: "Combat", window: { kind: "playerAttack" }, activeSeat: 0 };
  return send(window, { type: "DeclareAttackers", enemyId, attackerIds: [attackerId] }, ctx);
}

describe("Guarded (enemy): Sting", () => {
  it("is played onto the staging area, discards encounter cards until an enemy is discarded, adds it to the staging area and waits out of play on it (wor.guarded-x)", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const built = deck(table.state, ["marsh", "orc", "ford"]);
    const sting = put(built.state, "19117", "hand");
    expect(legalTargets(sting.state, { type: "PlayCard", cardId: sting.id }, ctx)).toEqual(["staging"]);
    const played = play(sting.state, sting.id, ctx, "staging");
    const [marsh, orc, ford] = built.ids;
    // The marsh was discarded, not revealed; the orc was discarded and added to the staging area, where it guards Sting; the ford stays.
    expect(played.staging).toEqual([orc]);
    expect(played.encounterDiscard).toEqual([marsh]);
    expect(played.encounterDeck).toEqual([ford]);
    expect(played.cards[sting.id]).toMatchObject({ zone: "setAside", host: orc, controller: 0 });
    expect(played.cards[orc ?? ""]?.attachments).toContain(sting.id);
    // The planning window is open again.
    expect(played.window).toEqual({ kind: "pass" });
    // Out of play: its constant (+1 Willpower to the attached hero) is nowhere.
    expect(played.modifiers.some((modifier) => modifier.sourceId === sting.id)).toBe(false);
  });

  it("is put into play on a Hobbit hero once the enemy that guards it is destroyed", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const built = deck(table.state, ["orc"]);
    const sting = put(built.state, "19117", "hand");
    const played = play(sting.state, sting.id, ctx, "staging");
    const orc = built.ids[0] ?? "";
    expect(played.cards[sting.id]?.host).toBe(orc);
    const engaged = updateCard({ ...played, staging: [] }, orc, {});
    const moved = settle({ ...engaged, seats: [{ ...engaged.seats[0], engaged: [orc] }, engaged.seats[1]], cards: { ...engaged.cards, [orc]: { ...engaged.cards[orc]!, zone: "engaged", controller: 0, damage: 2 } }, window: null, mode: "stopped" }, ctx, []);
    const killed = attack(moved, orc, table.heroes[0] ?? "");
    expect(killed.cards[orc]?.zone).toBe("encounterDiscard");
    // Sting goes on the only Hobbit hero, under its player's control, and is no longer set aside.
    expect(killed.cards[sting.id]).toMatchObject({ zone: "play", host: table.heroes[1], controller: 0 });
    expect(killed.setAside).not.toContain(sting.id);
  });

  it("shuffles the encounter discard pile into an empty deck and finishes the search (wor.guarded-x)", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const built = deck(table.state, ["marsh", "orc"]);
    // Both cards are in the discard pile and the deck is empty.
    const discarded = { ...built.state, encounterDeck: [], encounterDiscard: [...built.ids], cards: Object.fromEntries(Object.entries(built.state.cards).map(([id, card]) => [id, built.ids.includes(id) ? { ...card, zone: "encounterDiscard" as const } : card])) };
    const sting = put(discarded, "19117", "hand");
    const played = play(sting.state, sting.id, ctx, "staging");
    const orc = built.ids[1] ?? "";
    expect(played.cards[sting.id]).toMatchObject({ zone: "setAside", host: orc });
    expect(played.staging).toEqual([orc]);
  });

  it("enters play at once when the encounter deck holds no enemy", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const built = deck(table.state, ["marsh", "ford"]);
    const sting = put(built.state, "19117", "hand");
    const played = play(sting.state, sting.id, ctx, "staging");
    expect(played.cards[sting.id]).toMatchObject({ zone: "play", host: table.heroes[1] });
    expect(played.encounterDeck).toEqual(built.ids);
  });
});

describe("Guarded (location): Mithril Shirt", () => {
  it("is guarded by the first location revealed and asks for its hero once that location is explored", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const built = deck(table.state, ["orc", "ford"]);
    const shirt = put(built.state, "19152", "hand");
    const played = play(shirt.state, shirt.id, ctx, "staging");
    const [orc, ford] = built.ids;
    expect(played.cards[shirt.id]?.host).toBe(ford);
    expect(played.staging).toEqual([ford]);
    expect(played.encounterDiscard).toEqual([orc]);
    // The players travel to the ford and explore it: Mithril Shirt asks which hero takes it.
    const active = { ...played, staging: [orc ?? ""], activeLocation: ford ?? null, cards: { ...played.cards, [ford ?? ""]: { ...played.cards[ford ?? ""]!, zone: "activeLocation" as const, progress: 1 } } };
    const event = put(active, "12088", "hand");
    // Hithlain on the active ford: a Silvan ally played from the hand places the last progress.
    const hithlain = play(event.state, event.id, ctx, ford);
    const ally = put(hithlain, "silvan", "hand");
    const allyPlayed = play(ally.state, ally.id, ctx);
    const answered = send(allyPlayed, { type: "Trigger", cardId: hithlain.cards[event.id]?.id ?? event.id, effectId: "12088:response:1" }, ctx);
    expect(answered.cards[ford ?? ""]?.zone).toBe("encounterDiscard");
    expect(answered.window).toEqual({ kind: "choose", seat: 0, options: table.heroes });
    const placed = send(answered, { type: "Choose", optionId: table.heroes[1] ?? "" }, ctx);
    expect(placed.cards[shirt.id]).toMatchObject({ zone: "play", host: table.heroes[1] });
  });
});

describe("The King's Return", () => {
  it("searches the deck for a Guarded attachment and puts it into play, which reveals its guard", () => {
    const table = seat(1, ["ranger", "hobbit"]);
    const built = deck(table.state, ["orc"]);
    const axe = put(built.state, "22006", "deck");
    const other = put(axe.state, "05017", "deck");
    const event = put(other.state, "19147", "hand");
    const played = play(event.state, event.id, ctx);
    expect(played.cards[axe.id]).toMatchObject({ zone: "setAside", host: built.ids[0] });
    expect(played.cards[other.id]?.zone).toBe("deck");
    expect(played.cards[event.id]?.zone).toBe("discard");
  });

  it("may be played without a Guarded attachment in the deck: the search finds nothing (rr.search)", () => {
    const table = seat();
    const other = put(table.state, "05017", "deck");
    const event = put(other.state, "19147", "hand");
    expect(reduce(event.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx).ok).toBe(true);
  });
});

describe("offers", () => {
  it("offers Sting only in the planning phase like any attachment", () => {
    const table = seat();
    const sting = put(table.state, "19117", "hand");
    expect(offered(sting.state, ctx)).toContainEqual({ type: "PlayCard", cardId: sting.id });
    expect(offered({ ...sting.state, mode: "questCommit", phase: "Quest" }, ctx).some((intent) => intent.type === "PlayCard")).toBe(false);
  });
});

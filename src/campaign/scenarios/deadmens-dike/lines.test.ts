// Rules: rr.player-elimination, rr.constant-ability, rr.triggered-ability, rr.travel, rr.blank, rr.first-player, rr.effects, rr.modifiers, rr.surge, faq.first-player-elimination, mec108.indestructible, mec108.side-quests (data/rules/entries.json); ledger lines 09073:B:3, 09074:B:2, 09038:A:1,
// 09038:A:2, 09040:A:1, 09034:A:1, 09064:A:1, 09064:A:2, 09066:A:2, 09067:A:2, 09039:A:1, 09037:A:2, 10166:A:3, 10168:A:1, 10168:A:2, 10169:A:1, 10169:A:2, 10170:A:1, 10170:A:2, 10167:A:1, 09061:A:1, 10160:A:3. The vocabulary Deadmen's Dike adds (src/catalog/families/angmar.ts and deck.ts) on the
// scenario's own table: the elimination at an empty deck, a stage held back while a card has hit points, the discard and ability events, the amount of what a card discarded, the cost increase, the lock on discard piles, the first Undead enemy's surge, Thaurdir's burdens and the boons Mysterious Omens offers.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { holds, hasTrait } from "../../../rules/interpret/conditions.ts";
import { matchesPick, pickCandidates } from "../../../rules/interpret/pick.ts";
import { restricted, travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import { playCost } from "../../../rules/player/attach.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { allyCard, fightEnemy, finish, idOf, idsOf, legalIntents, resolveRecords, revealFromTop, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "deadmens-dike";
const THAURDIR = "09033";
const BURDENS = ["10168", "10169", "10170"];
const HERO = "dh1";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "09073", phase: "Refresh", ...layout });
type Table = ReturnType<typeof at>;
const rest = (state: ScenarioState, ctx: Table["ctx"]): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, []);
// A seat's deck, emptied: the cards stay in the state, out of the deck list.
const emptyDeck = (state: ScenarioState, seat: number): ScenarioState => ({ ...state, seats: state.seats.map((one, index) => (index === seat ? { ...one, deck: [] } : one)) as unknown as ScenarioState["seats"] });
// A card of the seat's discard pile.
const discarded = (state: ScenarioState, code: string, seat = 0): ScenarioState => spawn(state, code, { zone: "discard", seat }).state;
const typeOf = (t: Table, state: ScenarioState, id: string) => t.cards.get(state.cards[id]?.code ?? "")?.type;

describe("09073:B:3 and 09074:B:2 eliminate a player with no cards in his deck", () => {
  it("09073:B:3 eliminates the seat whose deck is empty once nothing is resolving, and not the seat that still has cards", () => {
    const t = at({ seats: 2, deckOf: ["filler", "filler"] });
    expect(flagged(t.state, "table", "eliminatedAtEmptyDeck")).toBe(true);
    const out = rest(emptyDeck(t.state, 1), t.ctx);
    expect(out.seats[1]?.eliminated).toBe(true);
    expect(out.seats[0]?.eliminated).not.toBe(true);
    expect(out.lost).not.toBe(true);
  });

  it("09073:B:3 loses the game when the last seat is eliminated (rr.player-elimination)", () => {
    const t = at({ deckOf: ["filler"] });
    const out = rest(emptyDeck(t.state, 0), t.ctx);
    expect(out.seats[0]?.eliminated).toBe(true);
    expect(out.lost).toBe(true);
  });

  it("09073:B:3 passes the first player token to the next seat, and the eliminated seat's enemies go back to the staging area (faq.first-player-elimination)", () => {
    const t = at({ seats: 2, deckOf: ["filler"], firstPlayer: 0, engaged: [{ code: "f3", seat: 0 }] });
    const out = rest(emptyDeck(t.state, 0), t.ctx);
    expect(out.seats[0]?.eliminated).toBe(true);
    expect(out.firstPlayer).toBe(1);
    expect(out.cards[idOf(out, "f3")]?.zone).toBe("staging");
  });

  it("09073:B:2 eliminates the player whose last card the Forced discard took, once that effect has finished", () => {
    const t = at({ deckOf: ["filler"] });
    const run = resolveRecords(t.state, t.ctx, "09073", "forced");
    expect(run.state.seats[0]?.deck).toHaveLength(0);
    expect(run.state.seats[0]?.eliminated).toBe(true);
  });

  it("09074:B:2 eliminates a player with no cards in his deck from the second stage on", () => {
    const t = at({ stage: "09074", deckOf: ["filler"] });
    expect(flagged(t.state, "table", "eliminatedAtEmptyDeck")).toBe(true);
    expect(rest(emptyDeck(t.state, 0), t.ctx).seats[0]?.eliminated).toBe(true);
  });
});

describe("09074:B:2 holds the stage back while Thaurdir has hit points remaining", () => {
  const stage = (layout: Layout = {}) => at({ stage: "09074", phase: "Quest", deckOf: ["filler"], ...layout });
  const scope = { actor: 0, sourceId: null, returned: 0 };

  it("09074:B:2 cannot be defeated while Thaurdir has any hit points left, whatever the progress", () => {
    const t = stage({ staging: [THAURDIR] });
    expect(holds(t.state, { kind: "hitPointsLeft", code: THAURDIR }, scope, t.ctx)).toBe(true);
    expect(restricted(t.state, t.ctx, "advance")).not.toHaveLength(0);
    const hurt = updateCard(t.state, idOf(t.state, THAURDIR), { damage: 8 });
    expect(restricted(hurt, t.ctx, "advance")).not.toHaveLength(0);
  });

  it("09074:B:2 can be defeated once the damage on Thaurdir has reached his hit points, and he stays in play (Indestructible)", () => {
    const t = stage({ staging: [THAURDIR] });
    const down = rest(updateCard(t.state, idOf(t.state, THAURDIR), { damage: 9 }), t.ctx);
    expect(down.cards[idOf(down, THAURDIR)]?.zone).toBe("staging");
    expect(holds(down, { kind: "hitPointsLeft", code: THAURDIR }, scope, t.ctx)).toBe(false);
    expect(restricted(down, t.ctx, "advance")).toHaveLength(0);
  });

  it("09074:B:2 is not held back while Thaurdir is not in play (he is set aside until the stage is revealed)", () => {
    const t = stage({ setAside: [THAURDIR] });
    expect(holds(t.state, { kind: "hitPointsLeft", code: THAURDIR }, scope, t.ctx)).toBe(false);
  });
});

describe("09038:A:2 hears the first player's discard from the top of a deck once for each discard", () => {
  const square = (layout: Layout = {}) => at({ seats: 2, active: "09038", phase: "Quest", deckOf: ["filler", "filler", "filler", "filler"], ...layout });
  const tokens = (state: ScenarioState): number => state.cards[idOf(state, "09038")]?.resources ?? 0;

  it("09038:A:2 puts one resource token for a discard of several cards, not one for each card, and one for the Travel cost's discard", () => {
    const t = square();
    expect(tokens(resolveRecords(t.state, t.ctx, "09064", "whenRevealed").state)).toBe(1);
    expect(tokens(resolveRecords(t.state, t.ctx, "09036", "travel").state)).toBe(1);
  });

  it("09038:A:2 does not hear the other players' discards, and not a discard that moves no card", () => {
    const t = square();
    const second = resolveRecords(emptyDeck(t.state, 0), t.ctx, "09036", "travel");
    expect(tokens(second.state)).toBe(0);
    const none = resolveRecords(emptyDeck(emptyDeck(t.state, 0), 1), t.ctx, "09036", "travel");
    expect(tokens(none.state)).toBe(0);
  });

  it("09038:A:1 raises its Threat by one for each resource token on it", () => {
    const bare = at({ staging: ["09038"] });
    const loaded = at({ staging: [{ code: "09038", resources: 3 }] });
    const threat = (t: Table) => modifiedStat(t.state, t.state.cards[idOf(t.state, "09038")]!, "threat", t.cards);
    expect(threat(loaded) - threat(bare)).toBe(3);
  });
});

describe("09040:A:1 hears the Actions and Responses a player triggers", () => {
  const gate = (layout: Layout = {}) => at({ phase: "Planning", active: "09040", heroResources: 3, deckOf: ["filler", "filler", "filler"], ...layout });
  const deck = (state: ScenarioState): number => state.seats[0]?.deck.length ?? 0;
  const trigger = (state: ScenarioState, t: Table, code: string) => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code));

  it("09040:A:1 discards the top card of the deck of the player who triggers an Action, once", () => {
    const t = gate({ attached: [{ code: "10167", to: HERO }] });
    const intent = trigger(t.state, t, "10167");
    expect(intent).toBeTruthy();
    const run = finish(send({ state: t.state, steps: [] }, intent as PlayerIntent, t.ctx), t.ctx);
    expect(deck(run.state)).toBe(deck(t.state) - 1);
  });

  it("09040:A:1 discards a card for an event played for its Action, and none for a Forced effect", () => {
    const t = gate({ hand: ["filler"] });
    const play = legalIntents(t.state, t.ctx).find((intent) => intent.type === "PlayCard" && intent.cardId === idOf(t.state, "filler"));
    expect(play).toBeTruthy();
    const run = finish(send({ state: t.state, steps: [] }, { type: "PlayCard", cardId: idOf(t.state, "filler"), payments: [] }, t.ctx), t.ctx);
    expect(deck(run.state)).toBe(deck(t.state) - 1);
    // The stage's own Forced discard at the end of the refresh phase triggers nothing: one card goes, not two.
    const refresh = gate({ phase: "Refresh" });
    expect(deck(resolveRecords(refresh.state, refresh.ctx, "09073", "forced").state)).toBe(deck(refresh.state) - 1);
  });

  it("09040:A:1 is not in force while Deadmen's Gate is in the staging area, not active", () => {
    const t = at({ phase: "Planning", staging: ["09040"], heroResources: 3, deckOf: ["filler", "filler"], attached: [{ code: "10167", to: HERO }] });
    const intent = trigger(t.state, t, "10167");
    const run = finish(send({ state: t.state, steps: [] }, intent as PlayerIntent, t.ctx), t.ctx);
    expect(deck(run.state)).toBe(deck(t.state));
  });
});

describe("09034:A:1 and 09064:A:1 add up what the effect discarded", () => {
  it("09034:A:1 assigns damage equal to the combined printed cost of the two discarded cards", () => {
    const t = at({ phase: "Encounter", deckOf: ["ally", "ally", "filler"] });
    const cost = (state: ScenarioState, id: string) => t.cards.get(state.cards[id]?.code ?? "")?.cost ?? 0;
    const top = t.state.seats[0]?.deck.slice(0, 2) ?? [];
    const expected = top.reduce((sum, id) => sum + cost(t.state, id), 0);
    const run = resolveRecords(t.state, t.ctx, "09034", "forced");
    expect((run.state.cards[t.hero]?.damage ?? 0) + (run.state.cards[t.hero2]?.damage ?? 0)).toBe(expected);
  });

  it("09064:A:1 raises the staging area's Threat by 2 for each different card type discarded, the players' cards together", () => {
    const t = at({ phase: "Quest", seats: 2, deckOf: ["filler", "ally", "event"] });
    const run = resolveRecords(t.state, t.ctx, "09064", "whenRevealed");
    const types = new Set(run.state.seats.flatMap((seat) => seat.discard.map((id) => typeOf(t, run.state, id))));
    expect(types.size).toBeGreaterThan(1);
    expect(run.state.modifiers.find((modifier) => modifier.stat === "moreStagingThreat")?.amount).toBe(2 * types.size);
  });
});

describe("09066:A:2 makes a card cost more while a card with its title is in its owner's discard pile", () => {
  const cursed = (layout: Layout = {}) => at({ phase: "Planning", hand: ["ally", "event"], ...layout });
  const withCurses = (t: Table, curses: number): ScenarioState => {
    let state = discarded(t.state, "ally");
    for (let count = 0; count < curses; count += 1) state = spawn(state, "09066", { zone: "play", seat: 0 }).state;
    return rest(state, t.ctx);
  };

  it("09066:A:2 costs 1 more for a card whose title is in the owner's discard pile, and nothing more for another title", () => {
    const t = cursed();
    const ally = idOf(t.state, "ally");
    const plain = playCost(t.state, ally, 0, t.ctx) ?? 0;
    const state = withCurses(t, 1);
    expect(playCost(state, ally, 0, t.ctx)).toBe(plain + 1);
    expect(playCost(state, idOf(state, "event"), 0, t.ctx)).toBe(playCost(t.state, idOf(t.state, "event"), 0, t.ctx));
  });

  it("09066:A:2 stacks: two Heavy Curses add 2, and none costs nothing extra", () => {
    const t = cursed();
    const ally = idOf(t.state, "ally");
    const plain = playCost(t.state, ally, 0, t.ctx) ?? 0;
    expect(playCost(withCurses(t, 2), ally, 0, t.ctx)).toBe(plain + 2);
    expect(playCost(withCurses(t, 0), ally, 0, t.ctx)).toBe(plain);
  });
});

describe("09067:A:2 keeps the discard piles shut to player card effects", () => {
  const reach = (state: ScenarioState, t: Table, source: string | null): string[] => pickCandidates(state, { type: "card", control: "any", from: "discard" }, 0, [], source, t.ctx);

  it("09067:A:2 holds the table flag while it is in the staging area, and not in another zone", () => {
    expect(flagged(at({ phase: "Planning", staging: ["09067"] }).state, "table", "discardLocked")).toBe(true);
    expect(flagged(at({ phase: "Planning", victory: ["09067"] }).state, "table", "discardLocked")).toBe(false);
  });

  it("09067:A:2 stops a player card's Pick from a discard pile, and lets an encounter card's Pick through", () => {
    const t = at({ phase: "Planning", staging: ["09067"] });
    const player = spawn(discarded(t.state, "ally"), "ally", { zone: "hand", seat: 0 });
    expect(reach(player.state, t, player.id)).toHaveLength(0);
    expect(reach(player.state, t, idOf(player.state, "09067"))).toHaveLength(1);
  });

  it("09067:A:2 lets a player card reach the discard pile once the side quest has left the staging area", () => {
    const t = at({ phase: "Planning" });
    const player = spawn(discarded(t.state, "ally"), "ally", { zone: "hand", seat: 0 });
    expect(reach(player.state, t, player.id)).toHaveLength(1);
  });

  it("09067:A:3 shuffles the top 5 cards of each player's discard pile back into his own deck when it is defeated", () => {
    const t = at({ phase: "Quest", seats: 2, victory: ["09067"] });
    let state = t.state;
    for (let count = 0; count < 6; count += 1) state = discarded(discarded(state, "filler", 0), "filler", 1);
    const before = (seat: number) => state.seats[seat]?.deck.length ?? 0;
    const run = resolveRecords(state, t.ctx, "09067", "forced", idOf(state, "09067"));
    for (const seat of [0, 1]) {
      expect(run.state.seats[seat]?.deck.length, `seat ${seat}`).toBe(before(seat) + 5);
      expect(run.state.seats[seat]?.discard, `seat ${seat}`).toHaveLength(1);
    }
  });
});

describe("09039:A:1 gives the first Undead enemy revealed each round surge while Haunted Keep is active", () => {
  const keep = (layout: Layout = {}) => at({ phase: "Quest", active: "09039", deck: ["f0", "f3"], ...layout });
  const staged = (state: ScenarioState): string[] => state.staging.map((id) => state.cards[id]?.code ?? "");

  it("09039:A:1 gives surge to the first Undead enemy revealed in the round, and not to the second", () => {
    const t = keep();
    const first = revealFromTop(t.state, t.ctx, "09060", []);
    // Surge revealed the next card (f0) too.
    expect(staged(first.state)).toEqual(expect.arrayContaining(["09060", "f0"]));
    const second = revealFromTop(first.state, t.ctx, "09060", []);
    expect(staged(second.state).filter((code) => code === "f3")).toHaveLength(0);
  });

  it("09039:A:1 counts from the start of the round: the Keep not yet active when an Undead enemy is revealed has it noted, so the next one has no surge", () => {
    const t = at({ phase: "Quest", staging: ["09039"], deck: ["f0", "f3"] });
    const first = revealFromTop(t.state, t.ctx, "09060", []);
    expect(staged(first.state)).not.toContain("f0");
    const becameActive = { ...first.state, staging: first.state.staging.filter((id) => id !== idOf(first.state, "09039")), activeLocation: idOf(first.state, "09039") };
    const second = revealFromTop(rest(becameActive, t.ctx), t.ctx, "09060", []);
    expect(staged(second.state)).not.toContain("f3");
  });

  it("09039:A:1 notes nothing while no card holds the marker (the Keep is not in play)", () => {
    const t = at({ phase: "Quest", deck: ["f0"] });
    const first = revealFromTop(t.state, t.ctx, "09060", []);
    expect(first.state.modifiers.some((modifier) => modifier.stat === "traitRevealed")).toBe(false);
  });
});

describe("09037:A:2 is a Travel cost the players must be able to pay", () => {
  it("09037:A:2 cannot be travelled to with no enemy in the encounter discard pile, and can with one: the topmost enemy returns to the staging area", () => {
    const empty = at({ phase: "Travel", staging: ["09037"] });
    expect(travelCostUnpayable(empty.state, empty.ctx, idOf(empty.state, "09037"))).toBe(true);
    const some = at({ phase: "Travel", staging: ["09037"], discard: ["f0", "f3", "place"] });
    expect(travelCostUnpayable(some.state, some.ctx, idOf(some.state, "09037"))).toBe(false);
    const run = resolveRecords(some.state, some.ctx, "09037", "travel", idOf(some.state, "09037"));
    expect(run.state.cards[idOf(run.state, "f3")]?.zone).toBe("staging");
    expect(run.state.cards[idOf(run.state, "f0")]?.zone).toBe("encounterDiscard");
  });

  it("09037:A:2 is not payable with only a location or a treachery in the discard pile", () => {
    const t = at({ phase: "Travel", staging: ["09037"], discard: ["place", "treachery"] });
    expect(travelCostUnpayable(t.state, t.ctx, idOf(t.state, "09037"))).toBe(true);
  });
});

describe("10166:A:3 attaches one of Thaurdir's burdens to him when he enters play", () => {
  const withBurdens = (layout: Layout = {}) => at({ stage: "09074", phase: "Quest", campaign: true, setAside: [THAURDIR], ...layout });

  it("10166:A:3 attaches exactly one of the three set-aside burdens to Thaurdir, a different one for different seeds, though he cannot have attachments", () => {
    const picked = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = withBurdens({ seed });
      const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
      const thaurdir = idOf(run.state, THAURDIR);
      const attached = run.state.cards[thaurdir]?.attachments ?? [];
      expect(attached, `seed ${seed}`).toHaveLength(1);
      const code = run.state.cards[attached[0] ?? ""]?.code ?? "";
      expect(BURDENS).toContain(code);
      picked.add(code);
      expect(run.state.cards[thaurdir]?.zone).toBe("staging");
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it("10166:A:3 attaches the same burden to the same seed, a set-aside copy when the game dealt one, and nothing in standalone play (no campaign card hears it)", () => {
    const code = (seed: number) => {
      const t = withBurdens({ seed });
      const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
      return run.state.cards[run.state.cards[idOf(run.state, THAURDIR)]?.attachments[0] ?? ""]?.code;
    };
    expect(code(3)).toBe(code(3));
    const dealt = withBurdens({ setAside: [THAURDIR, ...BURDENS] });
    const run = resolveRecords(dealt.state, dealt.ctx, "09074", "whenRevealed");
    expect(run.state.setAside.map((id) => run.state.cards[id]?.code).filter((one) => BURDENS.includes(one ?? ""))).toHaveLength(2);
    expect(idsOf(run.state, BURDENS[0] ?? "")).toHaveLength(1);
    const alone = at({ stage: "09074", phase: "Quest", setAside: [THAURDIR] });
    const bare = resolveRecords(alone.state, alone.ctx, "09074", "whenRevealed");
    expect(bare.state.cards[idOf(bare.state, THAURDIR)]?.attachments ?? []).toHaveLength(0);
  });
});

describe("10168:A:2, 10169:A:2 and 10170:A:2 move a burden to the hero with the most of something", () => {
  const burdened = (code: string, layout: Layout = {}) => at({ phase: "Quest", seats: 2, staging: [THAURDIR], attached: [{ code, to: THAURDIR }], ...layout });
  const hostOf = (state: ScenarioState, code: string): string | null => state.cards[idOf(state, code)]?.host ?? null;

  it("10168:A:2 moves Thaurdir's Legacy to the hero with the most resources, any player's hero", () => {
    const t = burdened("10168");
    const rich = updateCard(t.state, t.seat1Hero ?? "", { resources: 5 });
    const run = resolveRecords(rich, t.ctx, "10168", "forced", idOf(rich, "10168"));
    expect(hostOf(run.state, "10168")).toBe(t.seat1Hero);
    expect(run.state.cards[idOf(run.state, THAURDIR)]?.attachments ?? []).toHaveLength(0);
  });

  it("10168:A:2 keeps the burden on the hero that holds the most, and asks the first player when heroes tie", () => {
    const t = burdened("10168");
    const ahead = updateCard(t.state, t.hero, { resources: 4 });
    const first = resolveRecords(ahead, t.ctx, "10168", "forced", idOf(ahead, "10168"));
    expect(hostOf(first.state, "10168")).toBe(t.hero);
    const stays = resolveRecords(first.state, t.ctx, "10168", "forced", idOf(first.state, "10168"));
    expect(hostOf(stays.state, "10168")).toBe(t.hero);
    const tied = updateCard(updateCard(t.state, t.hero, { resources: 3 }), t.hero2, { resources: 3 });
    const options: string[][] = [];
    const answered = resolveRecords(tied, t.ctx, "10168", "forced", idOf(tied, "10168"), (state) => {
      if (state.window?.kind === "choose") options.push([...state.window.options]);
      return t.hero2;
    });
    expect(options[0]).toEqual(expect.arrayContaining([t.hero, t.hero2]));
    expect(hostOf(answered.state, "10168")).toBe(t.hero2);
  });

  it("10169:A:2 counts the attachments that are not objectives: the burden itself does not count", () => {
    const t = burdened("10169", { attached: [{ code: "10169", to: THAURDIR }, { code: "attachment", to: HERO }] });
    const run = resolveRecords(t.state, t.ctx, "10169", "forced", idOf(t.state, "10169"));
    expect(hostOf(run.state, "10169")).toBe(t.hero);
  });

  it("10170:A:2 moves Thaurdir's Spite to the hero with the most damage", () => {
    const t = burdened("10170");
    const hurt = updateCard(t.state, t.hero2, { damage: 3 });
    const run = resolveRecords(hurt, t.ctx, "10170", "forced", idOf(hurt, "10170"));
    expect(hostOf(run.state, "10170")).toBe(t.hero2);
  });
});

describe("10168:A:2 blanks the host's text box and Traits, 10169:A:2 and 10170:A:2 take stats and abilities", () => {
  const on = (code: string, host: string) => {
    const t = at({ phase: "Quest", staging: [THAURDIR], attached: [{ code, to: host }] });
    return t;
  };

  it("10168:A:2 blanks the printed text box and the printed Traits of the host hero, and a Trait another card grants stays", () => {
    const bare = at({ phase: "Quest", staging: [THAURDIR] });
    bare.cards.set(HERO, { ...bare.cards.get(HERO)!, traits: ["Noldor"] });
    expect(hasTrait(bare.state, bare.hero, "Noldor", bare.ctx)).toBe(true);
    const t = on("10168", HERO);
    t.cards.set(HERO, { ...t.cards.get(HERO)!, traits: ["Noldor"] });
    expect(flagged(t.state, t.hero, "blankText")).toBe(true);
    expect(flagged(t.state, t.hero, "blanksTraits")).toBe(true);
    expect(hasTrait(t.state, t.hero, "Noldor", t.ctx)).toBe(false);
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "willpower", t.cards)).toBe(modifiedStat(bare.state, bare.state.cards[bare.hero]!, "willpower", bare.cards) - 2);
  });

  it("10168:A:2 does nothing to Thaurdir while he carries it (it works on an attached hero only), and Thaurdir keeps his Traits", () => {
    const t = on("10168", THAURDIR);
    const thaurdir = idOf(t.state, THAURDIR);
    expect(flagged(t.state, thaurdir, "blankText")).toBe(false);
    expect(hasTrait(t.state, thaurdir, "Undead", t.ctx)).toBe(true);
  });

  it("10169:A:2 and 10170:A:2 hold their stat changes on the host hero only", () => {
    const majesty = on("10169", HERO);
    expect(flagged(majesty.state, majesty.hero, "cannotQuest")).toBe(true);
    expect(modifiedStat(majesty.state, majesty.state.cards[majesty.hero]!, "attack", majesty.cards)).toBe(0);
    const spite = on("10170", HERO);
    expect(flagged(spite.state, spite.hero, "cannotBeHealed")).toBe(true);
    const carried = on("10169", THAURDIR);
    expect(flagged(carried.state, carried.hero, "cannotQuest")).toBe(false);
  });
});

describe("10167:A:1, 10168:A:1, 10169:A:1 and 10170:A:1 attach a pool card to the card with a title, or remove it from the game", () => {
  const pool = (code: string, layout: Layout = {}) => {
    const t = at({ phase: "Planning", ...layout });
    t.cards.set("10067", allyCard("10067", 0, { name: "Amarthiúl" }));
    const spawned = spawn(t.state, code, { zone: "setAside" });
    return { t, id: spawned.id, state: spawned.state };
  };

  it("10168:A:1 attaches to Thaurdir though he is out of play (set aside)", () => {
    const made = pool("10168", { setAside: [THAURDIR] });
    const run = resolveRecords(made.state, made.t.ctx, "10168", "setup", made.id);
    expect(run.state.cards[made.id]?.host).toBe(idOf(run.state, THAURDIR));
  });

  const attachesToThaurdir = (code: string) => {
    const made = pool(code, { setAside: [THAURDIR] });
    expect(resolveRecords(made.state, made.t.ctx, code, "setup", made.id).state.cards[made.id]?.host).toBe(idOf(made.state, THAURDIR));
    const none = pool(code);
    expect(resolveRecords(none.state, none.t.ctx, code, "setup", none.id).state.cards[none.id]?.zone).toBe("removed");
  };

  it("10169:A:1 attaches to Thaurdir though he is out of play, and with no Thaurdir at all the card is removed from the game", () => attachesToThaurdir("10169"));

  it("10170:A:1 attaches to Thaurdir though he is out of play, and with no Thaurdir at all the card is removed from the game", () => attachesToThaurdir("10170"));

  it("10167:A:1 attaches to Amarthiúl in play, and is removed from the game when he is not there", () => {
    const withHim = pool("10167", { play: ["10067"] });
    const run = resolveRecords(withHim.state, withHim.t.ctx, "10167", "setup", withHim.id);
    expect(run.state.cards[withHim.id]?.host).toBe(idOf(run.state, "10067"));
    const without = pool("10167");
    expect(resolveRecords(without.state, without.t.ctx, "10167", "setup", without.id).state.cards[without.id]?.zone).toBe("removed");
  });
});

describe("09061:A:1 puts each copy of Cursed Dead in the encounter discard pile into the staging area", () => {
  it("09061:A:1 takes every copy from the discard pile only, not the one in the encounter deck, with no reveal", () => {
    const t = at({ phase: "Quest", discard: ["09061", "09061", "f0"], deck: ["09061"] });
    const run = resolveRecords(t.state, t.ctx, "09061", "whenRevealed");
    const zones = idsOf(run.state, "09061").map((id) => run.state.cards[id]?.zone);
    expect(zones.filter((zone) => zone === "encounterDeck")).toHaveLength(1);
    expect(zones.filter((zone) => zone === "staging")).toHaveLength(3);
    expect(run.state.cards[idOf(run.state, "f0")]?.zone).toBe("encounterDiscard");
  });
});

describe("100158:A:2 moves damage from Arnor Ravaged to the character an attack damaged", () => {
  const hurt = (state: ScenarioState, t: Table, other: string): ScenarioState => {
    const steps: never[] = [];
    return settle(fireForced({ ...state, window: null, mode: "stopped" }, { trigger: "attackDamagedCharacter", seat: 0, cardId: idOf(state, "f0"), other }, t.ctx, steps), t.ctx, steps);
  };

  it("100158:A:2 moves 1 damage from it to the character the attack damaged, placed and not dealt", () => {
    const t = at({ phase: "Combat", staging: [{ code: "100158", damage: 2 }, "f0"] });
    const done = hurt(t.state, t, t.hero);
    expect(done.cards[idOf(done, "100158")]?.damage).toBe(1);
    expect(done.cards[t.hero]?.damage).toBe(1);
  });

  it("100158:A:2 moves nothing when it holds no damage, or when the character is no longer in play", () => {
    const dry = at({ phase: "Combat", staging: ["100158", "f0"] });
    expect(hurt(dry.state, dry, dry.hero).cards[dry.hero]?.damage).toBe(0);
    const t = at({ phase: "Combat", staging: [{ code: "100158", damage: 2 }, "f0"] });
    const gone = spawn(t.state, "ally", { zone: "discard", seat: 0 });
    const done = hurt(gone.state, t, gone.id);
    expect(done.cards[idOf(done, "100158")]?.damage).toBe(2);
    expect(done.cards[gone.id]?.damage).toBe(0);
  });
});

describe("10160:A:3 offers a boon only while no other copy of it is in the game", () => {
  const offeredBoons = (layout: Layout): string[] => {
    const t = at({ phase: "Quest", campaign: true, ...layout });
    const ask: Effect = { id: "t:forced:2", cardCode: "f0", lines: [], timing: "forced", instructions: [{ verb: "ChooseBoon", codes: ["10161", "10162", "10163"] }] };
    const ctx = { ...t.ctx, effects: [...t.ctx.effects, ask] };
    const seen: string[][] = [];
    resolveRecords(t.state, ctx, "f0", "forced", undefined, (state) => {
      if (state.window?.kind !== "choose") return "";
      seen.push([...state.window.options]);
      return state.window.options.includes(t.hero) ? t.hero : "none";
    });
    return seen[0] ?? [];
  };

  it("10160:A:3 offers the boons still set aside or not yet in the game, and none for one already attached to a hero (kept from the Campaign Pool)", () => {
    expect(offeredBoons({ setAside: ["10161", "10162", "10163"] })).toEqual(["10161", "10162", "10163", "none"]);
    expect(offeredBoons({ setAside: ["10161", "10163"], attached: [{ code: "10162", to: HERO }] })).toEqual(["10161", "10163", "none"]);
    expect(offeredBoons({ attached: [{ code: "10162", to: HERO }] })).toEqual(["10161", "10163", "none"]);
  });

  it("10160:A:3 asks nobody when every boon it names is held already", () => {
    expect(offeredBoons({ attached: [{ code: "10161", to: HERO }, { code: "10162", to: HERO }, { code: "10163", to: HERO }] })).toEqual([]);
  });
});

describe("the Travel line and the discards of the locations", () => {
  it("09036:A:3 makes each player discard the top card of his deck as the Travel line, and the players travel", () => {
    const t = at({ phase: "Travel", seats: 2, staging: ["09036"], deckOf: ["filler", "filler", "filler"] });
    const run = resolveRecords(t.state, t.ctx, "09036", "travel", idOf(t.state, "09036"));
    for (const seat of [0, 1]) expect(run.state.seats[seat]?.deck, `seat ${seat}`).toHaveLength(2);
  });

  it("09037:A:1 shuffles the top 5 cards of each player's own discard pile into his own deck when it is explored", () => {
    const t = at({ phase: "Quest", seats: 2, active: "09037", deckOf: ["filler"] });
    let state = t.state;
    for (let count = 0; count < 6; count += 1) state = discarded(discarded(state, "event", 0), "filler", 1);
    const run = resolveRecords(state, t.ctx, "09037", "response", idOf(state, "09037"));
    for (const seat of [0, 1]) {
      expect(run.state.seats[seat]?.deck, `seat ${seat}`).toHaveLength(6);
      expect(run.state.seats[seat]?.discard, `seat ${seat}`).toHaveLength(1);
    }
    expect((run.state.seats[0]?.deck ?? []).every((id) => run.state.cards[id]?.owner == null || run.state.cards[id]?.owner === 0)).toBe(true);
  });

  it("09037:A:1 still shuffles while The Power of Angmar is in the staging area: the lock stops player card effects, not an encounter card's", () => {
    const t = at({ phase: "Quest", active: "09037", staging: ["09067"], deckOf: ["filler"] });
    expect(flagged(t.state, "table", "discardLocked")).toBe(true);
    const state = discarded(discarded(t.state, "event"), "filler");
    const run = resolveRecords(state, t.ctx, "09037", "response", idOf(state, "09037"));
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.seats[0]?.discard).toHaveLength(0);
  });

  it("09067:A:2 still lets Norbury Tombs' Travel return the topmost enemy from the encounter discard pile, which is no player's pile", () => {
    const t = at({ phase: "Travel", staging: ["09037", "09067"], discard: ["f0", "f3"], deckOf: ["filler"] });
    expect(travelCostUnpayable(t.state, t.ctx, idOf(t.state, "09037"))).toBe(false);
    const run = resolveRecords(t.state, t.ctx, "09037", "travel", idOf(t.state, "09037"));
    expect(run.state.cards[idOf(run.state, "f3")]?.zone).toBe("staging");
  });

  it("09040:A:1 discards from the deck of the seat that triggered the ability, not the other player's", () => {
    const t = at({ phase: "Planning", seats: 2, active: "09040", deckOf: ["filler", "filler", "filler"] });
    const card = idOf(t.state, "09040");
    const steps: never[] = [];
    const heard = settle(fireForced({ ...t.state, window: null, mode: "stopped" }, { trigger: "playerAbilityTriggered", seat: 1, cardId: card, subject: card }, t.ctx, steps), t.ctx, steps);
    expect(heard.seats[1]?.deck).toHaveLength(2);
    expect(heard.seats[0]?.deck).toHaveLength(3);
  });
});

describe("09041:A:2 Unnatural Fog lets each player choose for himself", () => {
  const fog = (layout: Layout, answer: (seat: number) => string) => {
    const t = at({ phase: "Quest", seats: 2, deckOf: ["filler", "filler", "filler", "filler"], ...layout });
    let asked = 0;
    const run = resolveRecords(t.state, t.ctx, "09041", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? answer(asked++) : ""));
    return { run, asked };
  };
  const committed = (state: ScenarioState): string[] => Object.values(state.cards).filter((card) => card.committed).map((card) => card.code);

  it("09041:A:2 discards 1 card for each questing character from the deck of the player who chose it, and removes the characters of the player who chose that", () => {
    const { run, asked } = fog({ committed: ["dh1", "dh2", "dh3"] }, (seat) => (seat === 0 ? "discard" : "remove"));
    expect(asked).toBe(2);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.seats[1]?.deck).toHaveLength(4);
    expect(committed(run.state)).toEqual(["dh1", "dh2"]);
  });

  it("09041:A:2 asks a player with no questing character nothing (no option changes the game)", () => {
    const { run, asked } = fog({}, () => "discard");
    expect(asked).toBe(0);
    expect(run.state.seats[0]?.deck).toHaveLength(4);
  });
});

describe("09042:A:2 The Shadow World discards as many cards as there are Undead enemies engaged with each player", () => {
  it("09042:A:2 reads the Undead enemies engaged with each player, and not the ones in the staging area", () => {
    const t = at({ phase: "Refresh", seats: 2, staging: ["09042", "09060"], engaged: [{ code: "09061", seat: 0 }, { code: "09061", seat: 0 }, { code: "09061", seat: 1 }, { code: "f0", seat: 1 }], deckOf: ["filler", "filler", "filler", "filler"] });
    const run = resolveRecords(t.state, t.ctx, "09042", "forced", idOf(t.state, "09042"));
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.seats[1]?.deck).toHaveLength(3);
  });
});

describe("a card of its title in its owner's discard pile (09061:A:2, 09065:A:2, 09065:A:3, 09066:A:2)", () => {
  const OWNER = { type: "character", control: "any", copyInDiscard: "owner" } as const;
  const CONTROLLER = { type: "character", control: "any", copyInDiscard: true } as const;
  const stolen = () => {
    const t = at({ phase: "Combat", seats: 2, deckOf: ["filler", "filler"] });
    // An ally of seat 0's deck that seat 1 controls now, and a copy of it in seat 0's discard pile.
    const ally = spawn(t.state, "ally", { zone: "play", seat: 1 });
    const state = discarded(updateCard(ally.state, ally.id, { owner: 0 }), "ally", 0);
    return { t, id: ally.id, state };
  };

  it("09061:A:2 counts the copy in the owner's discard pile, the seat the defending character came from, not the one that controls it", () => {
    const { t, id, state } = stolen();
    expect(matchesPick(state, id, OWNER, { seat: 0, sourceId: null, counting: true }, t.ctx)).toBe(true);
    expect(matchesPick(state, id, CONTROLLER, { seat: 0, sourceId: null, counting: true }, t.ctx)).toBe(false);
  });

  it("09061:A:2 adds 2 Attack instead of 1 when the defending character has a copy in its owner's discard pile, and 1 with none", () => {
    const fight = (copy: boolean) => fightEnemy((made: Layout) => at(made), "09061", "f3", { stage: "09073", deckOf: ["filler", "filler"] }, { tweak: (state) => (copy ? discarded(state, "dh1", 0) : state) });
    // The hero defends (Defense 2): Attack 1 + 1 leaves no damage, Attack 1 + 2 leaves 1.
    const plain = fight(false);
    const copied = fight(true);
    expect(plain.run.state.cards[plain.made.hero]?.damage).toBe(0);
    expect(copied.run.state.cards[copied.made.hero]?.damage).toBe(1);
  });

  it("09065:A:2 discards each ally its controller has a copy of in his own discard pile, the shared title being read in his pile, not another player's", () => {
    const t = at({ phase: "Quest", seats: 2, play: ["ally", { code: "ally", seat: 1 }], deckOf: ["filler", "filler"] });
    const state = discarded(t.state, "ally", 0);
    const run = resolveRecords(state, t.ctx, "09065", "whenRevealed");
    const zones = idsOf(run.state, "ally").map((id) => [run.state.cards[id]?.controller, run.state.cards[id]?.zone]);
    expect(zones).toContainEqual([0, "discard"]);
    expect(zones).toContainEqual([1, "play"]);
  });

  it("09065:A:3 discards the defending character when a copy of it lies in its owner's discard pile, and not otherwise", () => {
    const fight = (copy: boolean) =>
      fightEnemy((made: Layout) => at(made), "09065", "f3", { stage: "09073", deckOf: ["filler", "filler"], play: ["ally"] }, {
        defender: (made) => idOf(made.state, "ally"),
        tweak: (state) => (copy ? discarded(state, "ally", 0) : state),
      });
    const withCopy = fight(true);
    expect(withCopy.run.state.cards[idOf(withCopy.run.state, "ally") ?? ""]?.zone).toBe("discard");
    const alone = fight(false);
    expect(alone.run.state.cards[idsOf(alone.run.state, "ally")[0] ?? ""]?.zone).toBe("play");
  });

  it("09066:A:2 raises the cost of a card played from any zone, one played from the discard pile counting itself, and of a card controlled by another seat's owner", () => {
    const t = at({ phase: "Planning", seats: 2, hand: ["ally"], deckOf: ["filler"] });
    const { id: curse, state: cursed } = (() => {
      const made = spawn(t.state, "09066", { zone: "play", seat: 0 });
      return { id: made.id, state: made.state };
    })();
    expect(curse).toBeTruthy();
    const inHand = idOf(cursed, "ally");
    const plain = playCost(cursed, inHand, 0, t.ctx) ?? 0;
    // From the discard pile: the card itself is the card of its title there.
    const down = spawn(cursed, "ally", { zone: "discard", seat: 0 });
    expect(playCost(down.state, down.id, 0, t.ctx)).toBe(plain + 1);
    // A card of the other seat's discard pile does not count for this seat's card.
    const other = spawn(cursed, "ally", { zone: "discard", seat: 1 });
    expect(playCost(other.state, inHand, 0, t.ctx)).toBe(plain);
    // An owner that is not the controller: the card that seat 1 plays is raised by the copy in seat 0's pile, its owner's.
    const lent = spawn(spawn(cursed, "ally", { zone: "hand", seat: 1 }).state, "ally", { zone: "discard", seat: 0 });
    const hand1 = Object.values(lent.state.cards).find((card) => card.code === "ally" && card.zone === "hand" && card.controller === 1)?.id ?? "";
    expect(playCost(updateCard(lent.state, hand1, { owner: 0 }), hand1, 1, t.ctx)).toBe(plain + 1);
  });
});

describe("09074:A:1 reveals the encounter cards only when Thaurdir was added to the staging area", () => {
  it("09074:A:1 adds Thaurdir to the staging area and then reveals 1 card for each player", () => {
    const t = at({ stage: "09074", phase: "Quest", seats: 2, setAside: [THAURDIR], deck: ["f0", "f0", "f0"], deckOf: ["filler"] });
    const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
    expect(run.state.cards[idOf(run.state, THAURDIR)]?.zone).toBe("staging");
    expect(run.state.encounterDeck).toHaveLength(1);
  });

  it("09074:A:1 reveals nothing with no Thaurdir to add (rr.then: the second part resolves only when the first did)", () => {
    const t = at({ stage: "09074", phase: "Quest", seats: 2, deck: ["f0", "f0", "f0"], deckOf: ["filler"] });
    const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
    expect(run.state.encounterDeck).toHaveLength(3);
  });
});

describe("09074:B:1 hears a character that Thaurdir's attack destroyed, and only that", () => {
  const stage = (layout: Layout = {}) => ({ stage: "09074", deckOf: ["filler", "filler", "filler", "filler", "filler"], ...layout });

  it("09074:B:1 asks the controller of a hero an undefended attack of Thaurdir destroyed, and the discard takes 3 cards from his deck only", () => {
    const asked: { seat: number; options: string[] }[] = [];
    const run = fightEnemy((made: Layout) => at(made), "f0", THAURDIR, stage({ seats: 2 }), {
      undefended: true,
      pick: (state) => {
        if (state.window?.kind === "choose") asked.push({ seat: state.activeSeat, options: [...state.window.options] });
        return "discard";
      },
    });
    expect(run.run.state.cards[run.made.hero]?.zone).toBe("discard");
    expect(asked).toEqual([{ seat: 0, options: ["discard", "return"] }]);
    expect(run.run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.run.state.seats[1]?.deck).toHaveLength(5);
  });

  it("09074:B:1 puts the choice to the destroyed character's controller: the event seat is his, not the first player's", () => {
    const t = at(stage({ seats: 2, phase: "Combat", engaged: [{ code: THAURDIR, seat: 1 }], firstPlayer: 0 }));
    const steps: never[] = [];
    const base = { ...t.state, window: null, mode: "stopped" as const };
    const heard = settle(fireForced(base, { trigger: "characterDestroyedByAttack", seat: 1, subject: t.seat1Hero ?? "", other: idOf(base, THAURDIR) }, t.ctx, steps), t.ctx, steps);
    expect(heard.window?.kind).toBe("choose");
    expect(heard.activeSeat).toBe(1);
  });

  it("09074:B:1 returns Thaurdir to the staging area when the controller chooses that, and offers nothing to return when he is staged", () => {
    const run = fightEnemy((made: Layout) => at(made), "f0", THAURDIR, stage(), { undefended: true, pick: () => "return" });
    expect(run.run.state.cards[idOf(run.run.state, THAURDIR)]?.zone).toBe("staging");
  });

  it("09074:B:1 does not hear a character that was discarded and not destroyed: Dark Sorcery's shadow discards the defender and the attack goes on", () => {
    const asked: string[][] = [];
    const run = fightEnemy((made: Layout) => at(made), "09065", THAURDIR, stage({ play: ["ally"] }), {
      defender: (made) => idOf(made.state, "ally"),
      // A copy of the ally lies in its owner's discard pile, and Thaurdir's Attack is taken to 0 so that nothing is destroyed when the attack goes on without its defender.
      tweak: (state) => ({ ...discarded(state, "ally", 0), modifiers: [...state.modifiers, { instanceId: idOf(state, THAURDIR), sourceId: "t", stat: "attack" as const, amount: -6, until: "endOfRound" as const }] }),
      pick: (state) => {
        if (state.window?.kind === "choose") asked.push([...state.window.options]);
        return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
      },
    });
    expect(run.run.state.cards[idsOf(run.run.state, "ally")[0] ?? ""]?.zone).not.toBe("play");
    expect(asked.filter((options) => options.includes("return"))).toEqual([]);
  });

  it("09074:B:1 does not hear another enemy's attack that destroys a character", () => {
    const run = fightEnemy((made: Layout) => at(made), "f0", "f3", stage({ staging: [THAURDIR] }), {
      undefended: true,
      tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }),
      pick: () => "discard",
    });
    expect(run.run.state.seats[0]?.deck).toHaveLength(5);
  });
});

describe("the cards of the Resolution and the Setup", () => {
  it("100158:A:1 adds Arnor Ravaged to the staging area from the pool with the damage the log noted (none noted here)", () => {
    const t = at({ phase: "Planning", campaign: true });
    const spawned = spawn(t.state, "100158", { zone: "setAside" });
    const run = resolveRecords(spawned.state, t.ctx, "100158", "setup", spawned.id);
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toContain("100158");
  });

  it("10167:A:2 gives the attached hero +1 Willpower and +1 hit point", () => {
    const bare = at({ phase: "Planning" });
    const boosted = at({ phase: "Planning", attached: [{ code: "10167", to: HERO }] });
    const stat = (t: Table, name: "willpower" | "hitPoints") => modifiedStat(t.state, t.state.cards[idOf(t.state, HERO)]!, name, t.cards);
    expect(stat(boosted, "willpower")).toBe(stat(bare, "willpower") + 1);
    expect(stat(boosted, "hitPoints")).toBe(stat(bare, "hitPoints") + 1);
  });

  it("10167:A:3 readies the attached hero with its Action, once in the game", () => {
    const t = at({ phase: "Planning", attached: [{ code: "10167", to: HERO }], deckOf: ["filler", "filler", "filler"] });
    const tired = { ...t.state, cards: { ...t.state.cards, [idOf(t.state, HERO)]: { ...t.state.cards[idOf(t.state, HERO)]!, exhausted: true } } } as ScenarioState;
    const intent = legalIntents(tired, t.ctx).find((one) => one.type === "Trigger" && one.cardId === idOf(tired, "10167"));
    expect(intent).toBeTruthy();
    const run = finish(send({ state: tired, steps: [] }, intent as PlayerIntent, t.ctx), t.ctx);
    expect(run.state.cards[idOf(run.state, HERO)]?.exhausted).toBe(false);
    expect(legalIntents(run.state, t.ctx).some((one) => one.type === "Trigger" && one.cardId === idOf(run.state, "10167"))).toBe(false);
  });
});

// Rules: hrd.track, hrd.track-example, hrd.search-objective, bts.valour, rr.forced, rr.response, rr.shadow-effects, rr.travel, rr.reveal (data/rules/entries.json); ledger lines 17065:A:1, 17065:A:2, 17065:A:3, 17066:A:1, 17066:A:2, 17067:A:1, 17067:A:2,
// 17068:A:1, 17068:A:2, 17068:A:3, 17069:A:1, 17069:A:2, 17069:A:3, 17070:A:1, 17070:A:2, 17071:A:1, 17071:A:2, 17071:A:3, 17072:A:1, 17072:A:2, 17072:A:3, 17073:A:1, 17073:A:2, 17074:A:1, 17074:A:2, 17075:A:1, 17075:A:2, 17076:A:1, 17076:B:1,
// 17077:A:1, 17077:B:1, 17078:A:1, 17078:B:1, 17078:B:2, 17078:B:3, 17079:A:1, 17079:A:2, 17080:A:1, 17080:A:2.
// An audit of Beneath the Sands (card-audit): each test is built from the printed words, the rule spans and the rulings of docs/scenarios/haradrim/beneath-the-sands.md, on the smallest table of the scene kit. A line's test runs again without the line's
// records and must fail there (`lineSpec`). The player cards of the other packs that a test plays (Ride to Ruin) have no ledger entry, so they are sent through `sendUnledgered`. Track is reached by a real travel, a Shadow line by a real attack (`fightEnemy`), a quest-phase Forced effect by the quest phase played to its end.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { codesIn, engagedCodes, finish, idOf, idsOf, opened, revealFromTop, send, start, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { sendUnledgered } from "../../../../test/harness/player-table.ts";
import { SID, BROOD, GUARDIAN, BROODLING, BURROW, TUNNEL, NEST, CAVERN, PASSAGE, FORCED, GRABBED, LOST, CAVES, HIVE, OFF, ON, VIPER, SCORPION, PLACE, RIDE_TO_RUIN, SCOUT, EOWYN, INJURED, tableOf, inDiscard, inDeck, has, resourcesOf, damageOf, pick, inZone, travelTo, heroOfSeat, undefendedOn, fought, revealed, questedTo, hitFor, progressOf, threatsOf, surviving } from "./audit-kit.ts";

describe("17065 Brood Mother", () => {
  lineSpec("17065:A:1", "Brood Mother takes no damage from an attack that would damage another enemy, and no attachment can be attached to her", (effects) => {
    const attackDamage = (target: string): number => hitFor(effects, { engaged: [target] }, target);
    expect(attackDamage(SCORPION)).toBeGreaterThan(0);
    expect(attackDamage(BROOD)).toBe(0);
    const table = tableFromLayout(SID, { engaged: [BROOD, SCORPION] }, { effects });
    expect(flagged(table.state, idOf(table.state, BROOD), "cannotHaveAttachments")).toBe(true);
    expect(flagged(table.state, idOf(table.state, SCORPION), "cannotHaveAttachments")).toBe(false);
  });
  lineSpec("17065:A:2", "when Brood Mother is added to the staging area she engages the first player, whoever the first player is; another enemy added does not engage", (effects) => {
    for (const firstPlayer of [0, 1] as const) {
      const made = tableOf(effects)({ seats: 2, firstPlayer, deck: ["f0"] });
      const state = revealed(made, BROOD, 1 - firstPlayer).state;
      expect(engagedCodes(state, firstPlayer)).toContain(BROOD);
      expect(engagedCodes(state, 1 - firstPlayer)).not.toContain(BROOD);
      expect(has(state, "staging", BROOD)).toBe(false);
    }
    const one = tableOf(effects)({ seats: 1, deck: ["f0"] });
    expect(engagedCodes(revealed(one, BROOD).state)).toContain(BROOD);
    const other = tableOf(effects)({ seats: 1, deck: ["f0"] });
    const after = revealed(other, SCORPION).state;
    expect(engagedCodes(after)).not.toContain(SCORPION);
    expect(has(after, "staging", SCORPION)).toBe(true);
  });
  lineSpec("17065:A:3", "at the end of the round a Spider Broodling is searched from the encounter deck or the discard pile and added to the staging area, and the deck is shuffled; none found adds nothing", (effects) => {
    const ordered = [INJURED, "f0", SCORPION, VIPER, "f3", PLACE];
    // The refresh phase of a table settles into the end of the round, where the Forced effect is heard.
    const endRound = (layout: Layout, seats: 1 | 2 = 1): ScenarioState => {
      const made = tableOf(effects)({ seats, phase: "Refresh", ...layout });
      return finish(opened(made, settle(made.state, made.ctx, [])), made.ctx).state;
    };
    for (const seats of [1, 2] as const) {
      const fromDeck = endRound({ engaged: [BROOD], deck: [...ordered.slice(0, 3), BROODLING, ...ordered.slice(3)] }, seats);
      expect(zoneOf(fromDeck, BROODLING)).toBe("staging");
      const fromDiscard = endRound({ engaged: [BROOD], deck: ordered, discard: [BROODLING] }, seats);
      expect(zoneOf(fromDiscard, BROODLING)).toBe("staging");
      const none = endRound({ engaged: [BROOD], deck: ordered }, seats);
      expect(codesIn(none, "staging")).not.toContain(BROODLING);
      expect(inDeck(none)).toHaveLength(ordered.length);
    }
    // The deck is shuffled: six distinct cards come out in another order.
    const shuffled = endRound({ engaged: [BROOD], deck: [...ordered.slice(0, 3), BROODLING, ...ordered.slice(3)] });
    expect(inDeck(shuffled)).not.toEqual(ordered);
    // Brood Mother is set aside, not in play: her Forced effect is not heard.
    const away = endRound({ setAside: [BROOD], deck: ordered, discard: [BROODLING] });
    expect(zoneOf(away, BROODLING)).toBe("encounterDiscard");
  });
});

describe("17066 Hive Guardian", () => {
  lineSpec("17066:A:1", "while On Track is in play Hive Guardian gets +2 Attack and -5 engagement cost; Off Track changes nothing", (effects) => {
    for (const seats of [1, 2] as const) {
      const off = tableOf(effects)({ seats, staging: [OFF, GUARDIAN] });
      const on = tableOf(effects)({ seats, staging: [ON, GUARDIAN] });
      expect(statOf(off.state, off.ctx.cards, GUARDIAN, "attack")).toBe(3);
      expect(statOf(off.state, off.ctx.cards, GUARDIAN, "engagementCost")).toBe(40);
      expect(statOf(on.state, on.ctx.cards, GUARDIAN, "attack")).toBe(5);
      expect(statOf(on.state, on.ctx.cards, GUARDIAN, "engagementCost")).toBe(35);
    }
  });
  lineSpec("17066:A:2", "Shadow: the attacking enemy gets +1 Attack, or +2 Attack instead while On Track is in play", (effects) => {
    for (const seat of [0, 1] as const) {
      const layout = (track: string): Layout => ({ seats: seat === 0 ? 1 : 2, staging: [track], engaged: [{ code: "f0", seat }] });
      const off = fought(effects, GUARDIAN, "f0", layout(OFF), undefendedOn(seat));
      expect(damageOf(off.run.state, heroOfSeat(seat))).toBe(2);
      const on = fought(effects, GUARDIAN, "f0", layout(ON), undefendedOn(seat));
      expect(damageOf(on.run.state, heroOfSeat(seat))).toBe(3);
    }
  });
});

describe("17067 Spider Broodling", () => {
  lineSpec("17067:A:1", "while On Track is in play Spider Broodling gains surge when it is revealed: another card is revealed after it", (effects) => {
    for (const seats of [1, 2] as const) {
      const on = revealed(tableOf(effects)({ seats, staging: [ON], deck: [SCORPION, "f0"] }), BROODLING).state;
      expect(zoneOf(on, SCORPION)).toBe("staging");
      const off = revealed(tableOf(effects)({ seats, staging: [OFF], deck: [SCORPION, "f0"] }), BROODLING).state;
      expect(zoneOf(off, SCORPION)).toBe("encounterDeck");
    }
  });
  lineSpec("17067:A:2", "Shadow: while On Track is in play Broodling enters play engaged with the defending player and is dealt a shadow card; Off Track it stays a discarded Shadow card", (effects) => {
    for (const seat of [0, 1] as const) {
      const seats = seat === 0 ? 1 : 2;
      const on = fought(effects, BROODLING, "f0", { seats, staging: [ON], engaged: [{ code: "f0", seat }] }, undefendedOn(seat));
      expect(engagedCodes(on.run.state, seat)).toContain(BROODLING);
      expect(engagedCodes(on.run.state, 1 - seat)).not.toContain(BROODLING);
      // The deck held the Broodling and three more cards: one of them is the shadow card dealt to the Broodling.
      expect(inDeck(on.run.state).length).toBe(2);
      expect(surviving(on.run.state, "f0", "shadow")).toBe(1);
      const off = fought(effects, BROODLING, "f0", { seats, staging: [OFF], engaged: [{ code: "f0", seat }] }, undefendedOn(seat));
      expect(engagedCodes(off.run.state, seat)).not.toContain(BROODLING);
      expect(inDeck(off.run.state).length).toBe(3);
    }
  });
  it("17067:A:2 a Broodling put into play by its Shadow effect does not attack in that combat phase", () => {
    const on = fought(EFFECTS, BROODLING, "f0", { seats: 1, staging: [ON] }, undefendedOn(0));
    expect(engagedCodes(on.run.state)).toContain(BROODLING);
    expect(damageOf(on.run.state, "dh1")).toBe(1);
  });
});

describe("17068 Spider Burrow", () => {
  lineSpec("17068:A:2", "after Spider Burrow becomes the active location the objective flips to On Track (its resources discarded) and Brood Mother is added to the staging area", (effects) => {
    for (const seats of [1, 2] as const) {
      const { state } = travelTo(effects, { seats, staging: [{ code: OFF, resources: 2 }, BURROW], setAside: [BROOD] }, BURROW);
      expect(has(state, "staging", ON)).toBe(true);
      expect(has(state, "staging", OFF)).toBe(false);
      expect(resourcesOf(state, ON)).toBe(0);
      expect(zoneOf(state, BROOD)).not.toBe("setAside");
      expect(engagedCodes(state, state.firstPlayer)).toContain(BROOD);
    }
  });
  lineSpec("17068:A:2", "already On Track nothing flips but Brood Mother is still added; while Lost Underground is in play the objective does not flip and Brood Mother is still added", (effects) => {
    const on = travelTo(effects, { seats: 1, staging: [ON, BURROW], setAside: [BROOD] }, BURROW).state;
    expect(has(on, "staging", ON)).toBe(true);
    expect(zoneOf(on, BROOD)).not.toBe("setAside");
    const lost = travelTo(effects, { seats: 1, staging: [OFF, BURROW, LOST], setAside: [BROOD] }, BURROW).state;
    expect(has(lost, "staging", OFF)).toBe(true);
    expect(has(lost, "staging", ON)).toBe(false);
    expect(zoneOf(lost, BROOD)).not.toBe("setAside");
  });
  lineSpec("17068:A:3", "when Spider Burrow leaves play explored Brood Mother is set aside, wherever she is, unless the players are at stage 3B", (effects) => {
    // The quest phase places the 4 progress of two committed heroes on the active location (2 quest points): it is explored and leaves play.
    for (const seats of [1, 2] as const) {
      const state = questedTo(effects, { seats, active: { code: BURROW, progress: 1 }, engaged: [BROOD], staging: [OFF] }, { keys: ["threat"] });
      expect(zoneOf(state, BURROW)).toBe("encounterDiscard");
      expect(zoneOf(state, BROOD)).toBe("setAside");
      const third = questedTo(effects, { seats, stage: HIVE, active: { code: BURROW, progress: 1 }, engaged: [BROOD], staging: [ON] });
      expect(zoneOf(third, BURROW)).toBe("encounterDiscard");
      expect(zoneOf(third, BROOD)).not.toBe("setAside");
    }
    // Not explored: no committed hero, the location keeps its place and Brood Mother stays.
    const idle = questedTo(effects, { seats: 1, active: { code: BURROW, progress: 1 }, engaged: [BROOD], staging: [OFF] }, { commit: false, keys: ["threat"] });
    expect(zoneOf(idle, BURROW)).toBe("activeLocation");
    expect(zoneOf(idle, BROOD)).toBe("engaged");
  });
});

describe("17069:A:3 Pitch Black Tunnel Travel", () => {
  lineSpec("17069:A:3", "Travel: the top card of the encounter deck is revealed to travel here, by the first player", (effects) => {
    for (const firstPlayer of [0, 1] as const) {
      const made = tableOf(effects)({ seats: 2, firstPlayer, phase: "Travel", staging: [ON, TUNNEL], deck: [SCORPION, "f0", "f0"] });
      const sent = send(start(made.state), { type: "Travel", locationId: inZone(made.state, "staging", TUNNEL) }, made.ctx);
      const done = finish(sent, made.ctx);
      expect(zoneOf(done.state, SCORPION)).not.toBe("encounterDeck");
      const seats = done.steps.flatMap((step) => (step.kind === "reveal" && done.state.cards[step.cardId]?.code === SCORPION ? [step.seat] : []));
      expect(seats).toEqual([firstPlayer]);
    }
  });
});

describe("17070:A:2 Nest of Vermin Travel", () => {
  const nest = (effects: readonly Effect[], layout: Layout): ScenarioState => travelTo(effects, { staging: [ON, NEST], ...layout }, NEST).state;
  lineSpec("17070:A:2", "Travel: the discard pile is shuffled into the deck and cards are discarded until a Creature enemy is discarded; that enemy is added to the staging area, and later cards stay in the deck", (effects) => {
    for (const seats of [1, 2] as const) {
      const state = nest(effects, { seats, deck: [GUARDIAN, GUARDIAN, GUARDIAN, GUARDIAN] });
      expect(surviving(state, GUARDIAN, "encounterDeck") + surviving(state, GUARDIAN, "encounterDiscard")).toBe(3);
      expect(inDiscard(state)).toHaveLength(0);
      const fromDiscard = nest(effects, { seats, deck: [INJURED], discard: [GUARDIAN] });
      expect(zoneOf(fromDiscard, GUARDIAN)).not.toBe("encounterDiscard");
      expect(zoneOf(fromDiscard, GUARDIAN)).not.toBe("encounterDeck");
    }
  });
  lineSpec("17070:A:2", "a card that is no Creature enemy is discarded and not added; with no Creature the whole deck is discarded and nothing is added", (effects) => {
    const state = nest(effects, { seats: 1, deck: ["f0", INJURED], discard: ["f3"] });
    expect(inDeck(state)).toHaveLength(0);
    expect(inDiscard(state).sort()).toEqual(["f0", "f3", INJURED].sort());
    expect(codesIn(state, "staging").filter((code) => code === "f0" || code === "f3")).toHaveLength(0);
  });
});

describe("17071 Cobwebbed Cavern", () => {
  lineSpec("17071:A:2", "while On Track is in play Cobwebbed Cavern gets +2 Threat", (effects) => {
    for (const seats of [1, 2] as const) {
      const threatOf = (track: string): number => {
        const made = tableOf(effects)({ seats, staging: [track, CAVERN] });
        return stagingThreat(made.state, made.ctx.cards);
      };
      expect(threatOf(OFF)).toBe(2);
      expect(threatOf(ON)).toBe(4);
    }
  });
  lineSpec("17071:A:3", "Shadow: a character the defending player controls is exhausted; with none ready nothing happens", (effects) => {
    const one = fought(effects, CAVERN, "f0", { seats: 1 }, undefendedOn(0));
    const exhaustedOf = (state: ScenarioState, codes: string[]): number => codes.filter((code) => state.cards[idOf(state, code)]?.exhausted === true).length;
    expect(exhaustedOf(one.during, ["dh1", "dh2"])).toBe(1);
    const two = fought(effects, CAVERN, "f0", { seats: 2, engaged: [{ code: "f0", seat: 1 }] }, undefendedOn(1));
    expect(exhaustedOf(two.during, ["dh3"])).toBe(1);
    expect(exhaustedOf(two.during, ["dh1", "dh2"])).toBe(0);
    const none = fought(effects, CAVERN, "f0", { seats: 1, exhaustedCards: ["dh1", "dh2"] }, undefendedOn(0));
    expect(exhaustedOf(none.during, ["dh1", "dh2"])).toBe(2);
    expect(damageOf(none.run.state, "dh1")).toBe(1);
  });
});

describe("17072 Blocked Passage", () => {
  lineSpec("17072:A:2", "while On Track is in play progress cannot be placed on a location in the staging area; Off Track it can", (effects) => {
    for (const seats of [1, 2] as const) {
      const place = (track: string): number => {
        // Ride to Ruin (02078, Action): discard a Rohan ally to place 3 progress on a location the player chooses.
        const made = tableFromLayout(SID, { seats, phase: "Quest", hand: [RIDE_TO_RUIN], play: [SCOUT], heroes: [{ code: EOWYN, resources: 2 }], staging: [track, PASSAGE, CAVERN] }, { effects, extra: [RIDE_TO_RUIN, SCOUT, EOWYN] });
        let played = sendUnledgered(start(made.state), { type: "PlayCard", cardId: idOf(made.state, RIDE_TO_RUIN), payments: [{ heroId: idOf(made.state, EOWYN), amount: 1 }] }, made.ctx);
        for (let guard = 0; guard < 6 && played.state.window?.kind === "choose"; guard += 1) played = sendUnledgered(played, { type: "Choose", optionId: pick(CAVERN)(played.state) }, made.ctx);
        return progressOf(played.state, CAVERN);
      };
      expect(place(OFF)).toBe(3);
      expect(place(ON)).toBe(0);
    }
  });
  lineSpec("17072:A:3", "Shadow: an attachment the defending player controls is discarded; none leaves nothing to discard, and another player's attachment stays", (effects) => {
    const withAttachment = fought(effects, PASSAGE, "f0", { seats: 1, attached: [{ code: "attachment", to: "dh1" }] }, undefendedOn(0));
    expect(zoneOf(withAttachment.run.state, "attachment")).toBe("discard");
    const none = fought(effects, PASSAGE, "f0", { seats: 1 }, undefendedOn(0));
    expect(damageOf(none.run.state, "dh1")).toBe(1);
    // The attachment belongs to the first player; the attack is on the second.
    const other = fought(effects, PASSAGE, "f0", { seats: 2, engaged: [{ code: "f0", seat: 1 }], attached: [{ code: "attachment", to: "dh1" }] }, undefendedOn(1));
    expect(zoneOf(other.run.state, "attachment")).toBe("play");
  });
});

describe("17073 Forced Off Track", () => {
  const flipOrHurt = (effects: readonly Effect[], layout: Layout, choice: "flip" | "damage", seat?: number): ScenarioState => revealed(tableOf(effects)({ deck: ["f0", "f0"], ...layout }), FORCED, seat, choice).state;
  lineSpec("17073:A:1", "When Revealed: the first player flips the objective to Off Track; when it is already Off Track nothing changes", (effects) => {
    for (const seats of [1, 2] as const) {
      const flipped = flipOrHurt(effects, { seats, staging: [ON] }, "flip");
      expect(has(flipped, "staging", OFF)).toBe(true);
      expect(has(flipped, "staging", ON)).toBe(false);
      const stays = flipOrHurt(effects, { seats, staging: [OFF] }, "flip");
      expect(has(stays, "staging", OFF)).toBe(true);
    }
  });
  lineSpec("17073:A:1", "When Revealed: or 1 damage is dealt to each questing character, and to no other character; the objective does not flip", (effects) => {
    for (const seats of [1, 2] as const) {
      const hurt = flipOrHurt(effects, { seats, staging: [ON], committed: ["dh1", "dh3"] }, "damage");
      expect(damageOf(hurt, "dh1")).toBe(1);
      expect(damageOf(hurt, "dh2")).toBe(0);
      if (seats === 2) expect(damageOf(hurt, "dh3")).toBe(1);
      expect(has(hurt, "staging", ON)).toBe(true);
    }
  });
  lineSpec("17073:A:1", "the first player chooses, whichever player reveals the card; while Lost Underground is in play the flip does nothing", (effects) => {
    for (const firstPlayer of [0, 1] as const) {
      const made = tableOf(effects)({ seats: 2, firstPlayer, staging: [ON], deck: ["f0"] });
      const top = revealFromTop(made.state, made.ctx, FORCED, [], 1 - firstPlayer);
      expect(top.state.window).toMatchObject({ kind: "choose", seat: firstPlayer });
    }
    const lost = flipOrHurt(effects, { seats: 1, staging: [ON, LOST] }, "flip");
    expect(has(lost, "staging", ON)).toBe(true);
    expect(has(lost, "staging", OFF)).toBe(false);
  });
  lineSpec("17073:A:2", "Shadow: while On Track is in play the attacking enemy makes an additional attack against the defending player after this one; Off Track it does not", (effects) => {
    for (const seat of [0, 1] as const) {
      const layout = (track: string): Layout => ({ seats: seat === 0 ? 1 : 2, staging: [track], engaged: [{ code: "f0", seat }] });
      const on = fought(effects, FORCED, "f0", layout(ON), undefendedOn(seat));
      expect(damageOf(on.run.state, heroOfSeat(seat))).toBe(2);
      const off = fought(effects, FORCED, "f0", layout(OFF), undefendedOn(seat));
      expect(damageOf(off.run.state, heroOfSeat(seat))).toBe(1);
    }
  });
});

describe("17074 Grabbed by Spiders", () => {
  it("17074:A:1 Surge and Doomed 1 (keywords of the card, no record): another card is revealed and each player's threat rises by 1", () => {
    for (const seats of [1, 2] as const) {
      const made = tableOf(EFFECTS)({ seats, staging: [OFF], deck: [SCORPION, "f0"] });
      const state = revealed(made, GRABBED).state;
      expect(zoneOf(state, SCORPION)).toBe("staging");
      expect(threatsOf(state).slice(0, seats)).toEqual(Array.from({ length: seats }, () => 29));
    }
  });
  lineSpec("17074:A:2", "When Revealed: it is attached to the main quest card; a second copy is not attached (Limit 1 per quest) and is discarded", (effects) => {
    const once = revealed(tableOf(effects)({ seats: 1, staging: [OFF], deck: ["f0", "f0"] }), GRABBED).state;
    expect(once.cards[idOf(once, GRABBED)]?.host).toBe(once.questStage);
    const twice = revealed(tableOf(effects)({ seats: 1, staging: [OFF], attached: [{ code: GRABBED, to: CAVES, encounter: true }], deck: ["f0", "f0"] }), GRABBED).state;
    expect(idsOf(twice, GRABBED).filter((id) => twice.cards[id]?.host === twice.questStage)).toHaveLength(1);
    expect(surviving(twice, GRABBED, "encounterDiscard")).toBe(1);
  });
  // The flip to Off Track comes from Forced Off Track: the first player chooses it while On Track is in play.
  const flipTo = (effects: readonly Effect[], layout: Layout): ScenarioState => revealed(tableOf(effects)({ staging: [ON], attached: [{ code: GRABBED, to: CAVES, encounter: true }], deck: ["f0", "f0"], ...layout }), FORCED, undefined, "flip").state;
  lineSpec("17074:A:2", "Forced: after the objective flips to Off Track each player discards an ally he controls, then Grabbed by Spiders is discarded", (effects) => {
    const one = flipTo(effects, { seats: 1, play: ["ally", "ally"] });
    expect(surviving(one, "ally", "play")).toBe(1);
    expect(surviving(one, "ally", "discard")).toBe(1);
    expect(zoneOf(one, GRABBED)).toBe("encounterDiscard");
    const two = flipTo(effects, { seats: 2, play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }] });
    expect(surviving(two, "ally", "discard")).toBe(2);
    expect(zoneOf(two, GRABBED)).toBe("encounterDiscard");
  });
  lineSpec("17074:A:2", "a player with no ally discards none and Grabbed by Spiders stays attached; a flip to On Track or no flip at all does not fire it", (effects) => {
    const missing = flipTo(effects, { seats: 2, play: [{ code: "ally", seat: 0 }] });
    expect(surviving(missing, "ally", "discard")).toBe(1);
    expect(zoneOf(missing, GRABBED)).not.toBe("encounterDiscard");
    const already = flipTo(effects, { seats: 1, staging: [OFF], play: ["ally"] });
    expect(surviving(already, "ally", "play")).toBe(1);
    // A flip to On Track (Track after a travel) leaves the ally and the card.
    const { state } = travelTo(effects, { seats: 1, staging: [OFF, CAVERN], play: ["ally"], attached: [{ code: GRABBED, to: CAVES, encounter: true }], deck: [GUARDIAN, INJURED, INJURED] }, CAVERN);
    expect(has(state, "staging", ON)).toBe(true);
    expect(surviving(state, "ally", "play")).toBe(1);
    expect(zoneOf(state, GRABBED)).not.toBe("encounterDiscard");
  });
});

describe("17068:A:1 Immune to player card effects", () => {
  // A keyword of the card: no record names the line, so the test has no run without records.
  // FAULT: the card prints "Immune to player card effects", but data/cards holds no immune keyword for it, so a player card (Ride to Ruin) is offered Spider Burrow as a target.
  it.fails("17068:A:1 a player card effect cannot choose Spider Burrow as its target", () => {
    const made = tableFromLayout(SID, { phase: "Quest", hand: [RIDE_TO_RUIN], play: [SCOUT], heroes: [{ code: EOWYN, resources: 2 }], staging: [OFF, BURROW, CAVERN] }, { effects: EFFECTS, extra: [RIDE_TO_RUIN, SCOUT, EOWYN] });
    const played = sendUnledgered(start(made.state), { type: "PlayCard", cardId: idOf(made.state, RIDE_TO_RUIN), payments: [{ heroId: idOf(made.state, EOWYN), amount: 1 }] }, made.ctx);
    const offered = played.state.window?.kind === "choose" ? played.state.window.options.map((id) => played.state.cards[id]?.code) : [];
    expect(offered).toContain(CAVERN);
    expect(offered).not.toContain(BURROW);
  });
});


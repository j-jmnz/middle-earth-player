// Rules: rr.shadow-effects, rr.forced, rr.surge, rr.engaged, rr.optional-engagement, rr.explored, rr.action, rr.lasting-effects, rr.first-player, rr.attachment-cards, faq.additional-attacks, emce.evil-creatures-deck (data/rules/entries.json);
// ledger lines 18017:A:1, 18017:A:2, 18018:A:2, 18019:A:1, 18019:A:2, 18020:A:1, 18020:A:2, 18020:A:3, 18021:A:1, 18021:A:2, 18021:A:3, 18022:A:1, 18022:A:2, 18023:A:2, 18024:A:1, 18024:A:2, 18025:A:3.
// The encounter cards of Journey Up the Anduin, each test written from the printed line. Rows run on `tableFromLayout` (test/harness/card-spec.ts) and run again without the line's records; the tests
// that need two steps, a second player or a false case build the same table. The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; the ally stand-in has 1 Defense and 2 hit points.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { answer, attack, attackersOf, cardSpecs, damageOn, deckCount, defend, exhausted, flag, offers, respond, reveal, stat, threat, zone, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { finish, idOf, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "journey-up-the-anduin";
// Codes read from data/scenarios/journey-up-the-anduin.json and data/cards.
const WOODED_RIVERBANK = "18017";
const FRENZIED_CREATURE = "18018";
const DANGEROUS_CROSSING = "18019";
const GOBLIN_TROOP = "18020"; // Goblin Orc, 5 Attack, 4 Defense
const STRAY_GOBLIN = "18021";
const PACK_OF_WARGS = "18022"; // 4 Attack
const HILLS = "18023";
const LONELY_LANDS = "18024"; // Threat 2
const RUINED_SUPPLIES = "18025";
const WOLF_RIDER = "01081"; // Goblin Orc, 2 Attack, 0 Defense
const HILL_TROLL = "01082"; // Troll, 6 Attack, 3 Defense
const SNIPER = "01083"; // Goblin Orc, 2 Attack, 0 Defense
const BANKS = "01113"; // Threat 1
const GLADDEN = "01114"; // Threat 3
const TURAYN = "12166"; // 3 Defense, 3 hit points

const evil = (...codes: string[]): Layout["piles"] => ({ evilCreaturesDeck: codes });

const ROWS: readonly Row[] = [
  // 18017 Wooded Riverbank: "Forced: When Wooded Riverbank is explored, put the top card of the Evil Creatures deck into play engaged with the first player."
  { line: "18017:A:1", name: "explored, the top Evil Creatures card comes into play engaged", layout: { staging: [WOODED_RIVERBANK], piles: evil(HILL_TROLL, WOLF_RIDER) }, act: { act: "announce", trigger: "locationExplored", code: WOODED_RIVERBANK }, expect: [zone(HILL_TROLL, "engaged"), zone(WOLF_RIDER, "evilCreaturesDeck")] },
  // "Shadow: Deal 1 damage to the defending character." The filler's 1 Attack does nothing against Defense 2.
  { line: "18017:A:2", name: "its Shadow deals 1 damage to the defending character", act: [attack("f0", { shadow: WOODED_RIVERBANK }), defend("dh1")], expect: damageOn("dh1", 1) },

  // 18018 Frenzied Creature: "Shadow: Attach this card to attacking enemy." As a Condition it gives +1 Attack, so Goblin Sniper strikes 3 against Defense 2.
  { line: "18018:A:2", name: "its Shadow attaches it to the attacking enemy, which gets +1 Attack for this attack", act: [attack(SNIPER, { shadow: FRENZIED_CREATURE }), defend("dh1")], expect: [zone(FRENZIED_CREATURE, "attached"), damageOn("dh1", 1)] },

  // 18019 Dangerous Crossing: "Each player assigns X damage among characters he controls, where X is the Threat of the active location. If X is less than 3, Dangerous Crossing gains surge."
  { line: "18019:A:1", name: "X is the active location's Threat 3, assigned among the player's characters, and no surge", layout: { active: GLADDEN, deck: ["f0"] }, act: [reveal(DANGEROUS_CROSSING), answer("dh1"), answer("dh2"), answer("dh2")], expect: [damageOn("dh1", 1), damageOn("dh2", 2), deckCount(1)] },
  { line: "18019:A:1", name: "X is 1 below 3: 1 damage and it gains surge", layout: { active: BANKS, deck: ["f0"] }, act: [reveal(DANGEROUS_CROSSING), answer("dh2")], expect: [damageOn("dh2", 1), zone("f0", "staging")] },
  // "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the defender is damaged)." Goblin Sniper's 2 Attack.
  { line: "18019:A:2", name: "its Shadow gives +1 Attack against an undamaged defender", act: [attack(SNIPER, { shadow: DANGEROUS_CROSSING }), defend("dh1")], expect: damageOn("dh1", 1) },
  { line: "18019:A:2", name: "its Shadow gives +2 Attack instead against a damaged defender", layout: { play: [{ code: TURAYN, seat: 0, damage: 1 }] }, act: [attack(SNIPER, { shadow: DANGEROUS_CROSSING }), defend(TURAYN)], expect: damageOn(TURAYN, 2) },

  // 18020 Goblin Troop: "Cannot have player card attachments."
  { line: "18020:A:1", name: "it cannot have player card attachments", layout: { engaged: [GOBLIN_TROOP] }, act: [], expect: flag(GOBLIN_TROOP, "noPlayerAttachments") },
  // "While Goblin Troop is engaged with you, each other Goblin enemy engaged with you gets +1 Attack and +1 Defense."
  { line: "18020:A:2", name: "another Goblin engaged with the same player gets +1 Attack and +1 Defense", layout: { engaged: [GOBLIN_TROOP, SNIPER] }, act: [], expect: [stat(SNIPER, "attack", 3), stat(SNIPER, "defense", 1)] },
  { line: "18020:A:2", name: "two Goblin Troops engaged with one player each give the other the bonus", layout: { engaged: [GOBLIN_TROOP, GOBLIN_TROOP] }, act: [], expect: [stat(GOBLIN_TROOP, "attack", 6), stat(GOBLIN_TROOP, "defense", 5)] },
  // "Shadow: Attacking enemy gets +2 Attack."
  { line: "18020:A:3", name: "its Shadow gives the attacker +2 Attack", act: [attack(SNIPER, { shadow: GOBLIN_TROOP }), defend("dh1")], expect: damageOn("dh1", 2) },

  // 18021 Stray Goblin: "Cannot be optionally engaged."
  { line: "18021:A:1", name: "no player may optionally engage it", layout: { phase: "Encounter", staging: [STRAY_GOBLIN] }, act: [], expect: offers("Engage", undefined, false) },
  // "While Stray Goblin is in the staging area, it gains: 'Forced: After a player engages an enemy, Stray Goblin engages that player.'" An engagement check engages too.
  { line: "18021:A:2", name: "in the staging area it engages the player after he engages an enemy", layout: { staging: [STRAY_GOBLIN], engaged: [WOLF_RIDER] }, act: { act: "announce", trigger: "engaged", code: WOLF_RIDER }, expect: zone(STRAY_GOBLIN, "engaged") },
  // "Shadow: Add Stray Goblin to staging area."
  { line: "18021:A:3", name: "its Shadow adds it to the staging area", act: [attack(SNIPER, { shadow: STRAY_GOBLIN }), defend("dh1")], expect: zone(STRAY_GOBLIN, "staging") },

  // 18022 Pack of Wargs: "Forced: If Pack of Wargs is dealt a shadow card with no effect, it makes an additional attack after this one. (Do not deal it a shadow card.)" Both attacks are undefended; the deck keeps the 3 cards the first shadow card left.
  { line: "18022:A:1", name: "a shadow card with no effect gives it an additional attack, dealt no shadow card", act: [attack(PACK_OF_WARGS, { shadow: "f0", undefended: true })], expect: [attackersOf("dh1", [PACK_OF_WARGS, PACK_OF_WARGS]), deckCount(3)] },
  // "Shadow: Return attacking enemy to the staging area after this attack." The attack still lands: the filler's 1 undefended damage.
  { line: "18022:A:2", name: "its Shadow returns the attacker to the staging area after the attack", act: attack("f0", { shadow: PACK_OF_WARGS, undefended: true }), expect: [zone("f0", "staging"), damageOn("dh1", 1)] },

  // 18023 Hills of Wilderland: "Quest Action: Exhaust a character to reduce Hills of Wilderland Threat by 1 until the end of the phase." X is 2, the two heroes of the one player.
  { line: "18023:A:2", name: "the first player exhausts a character and its Threat is 1 lower", layout: { phase: "Quest", staging: [HILLS] }, act: [respond(HILLS), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false), stat(HILLS, "threat", 1)] },

  // 18024 Lonely Lands: "Lonely Lands gets +2 Threat for each facedown card under it."
  { line: "18024:A:1", name: "+2 Threat for each facedown card under it", layout: { staging: [LONELY_LANDS], under: [{ code: "event", to: LONELY_LANDS }, { code: "event", to: LONELY_LANDS }] }, act: [], expect: stat(LONELY_LANDS, "threat", 6) },

  // 18025 Ruined Supplies: "Shadow: Raise your threat by 1 for each enemy engaged with you." Three enemies are engaged with the defending player (the attacker among them).
  { line: "18025:A:3", name: "its Shadow raises the defending player's threat by 1 for each enemy engaged with him", layout: { engaged: [SNIPER, WOLF_RIDER, HILL_TROLL] }, act: [attack(SNIPER, { shadow: RUINED_SUPPLIES }), defend("dh1")], expect: threat(31) },
  { line: "18025:A:3", name: "an enemy engaged with the other player is not counted", layout: { seats: 2, engaged: [{ code: HILL_TROLL, seat: 1 }] }, act: [attack(SNIPER, { shadow: RUINED_SUPPLIES }), defend("dh1")], expect: [threat(29), threat(28, 1)] },
];

cardSpecs(SCENARIO, ROWS);

const played = (layout: Layout, act: Act | readonly Act[]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS, false);
const statOf = (run: Run, ctx: ReturnType<typeof tableFromLayout>["ctx"], code: string, name: Parameters<typeof modifiedStat>[2]) => modifiedStat(run.state, run.state.cards[idOf(run.state, code)]!, name, ctx.cards);

describe("Journey Up the Anduin encounter lines that need more than one row", () => {
  it("18017:A:1 engages the enemy with the first player, not the player the event names", () => {
    const done = played({ seats: 2, firstPlayer: 1, staging: [WOODED_RIVERBANK], piles: evil(HILL_TROLL) }, { act: "announce", trigger: "locationExplored", code: WOODED_RIVERBANK });
    expect(done.run.state.cards[idOf(done.run.state, HILL_TROLL)]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("18017:A:1 shuffles the Evil Creatures discard pile back into the empty deck and engages its top card", () => {
    // A layout deals no empty pile: the dealt, empty Evil Creatures deck is set by hand (emce.evil-creatures-deck).
    const made = tableFromLayout(SCENARIO, { staging: [WOODED_RIVERBANK], piles: { evilCreaturesDiscard: [HILL_TROLL] } });
    const state = { ...made.state, piles: { ...made.state.piles, evilCreaturesDeck: [] } };
    const run = resolveRecords(state, made.ctx, WOODED_RIVERBANK, "forced", idOf(state, WOODED_RIVERBANK));
    expect(run.state.cards[idOf(run.state, HILL_TROLL)]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("18017:A:2 deals no damage of its own to an undefended attack: there is no defending character", () => {
    const done = played({}, attack("f0", { shadow: WOODED_RIVERBANK, undefended: true }));
    // The filler's 1 Attack lands on the hero; the Shadow adds nothing.
    expect(done.run.state.cards[done.table.hero]?.damage).toBe(1);
  });

  it("18018:A:2 attaches to Goblin Troop as well: an encounter card is not a player card attachment", () => {
    const done = played({}, [attack(GOBLIN_TROOP, { shadow: FRENZIED_CREATURE }), defend("dh1")]);
    const troop = done.run.state.cards[idOf(done.run.state, GOBLIN_TROOP)]!;
    expect(troop.attachments.map((id) => done.run.state.cards[id]?.code)).toContain(FRENZIED_CREATURE);
  });

  it("18019:A:1 makes each of two players assign X damage among the characters he controls", () => {
    const done = played({ seats: 2, active: GLADDEN, deck: ["f0"] }, reveal(DANGEROUS_CROSSING));
    const { state } = done.run;
    expect((state.cards[done.table.hero]?.damage ?? 0) + (state.cards[done.table.hero2]?.damage ?? 0)).toBe(3);
    expect(state.cards[done.table.seat1Hero ?? ""]?.damage).toBe(3);
  });

  it("18019:A:1 gains surge with no active location (X is 0) and deals no damage", () => {
    const done = played({ deck: ["f0"] }, reveal(DANGEROUS_CROSSING));
    expect(done.run.state.cards[idOf(done.run.state, "f0")]?.zone).toBe("staging");
    expect((done.run.state.cards[done.table.hero]?.damage ?? 0) + (done.run.state.cards[done.table.hero2]?.damage ?? 0)).toBe(0);
  });

  it("18020:A:1 bars a player card attachment and not an encounter card", () => {
    const made = tableFromLayout(SCENARIO, { engaged: [GOBLIN_TROOP, SNIPER] });
    const troop = idOf(made.state, GOBLIN_TROOP);
    expect(attachBlocked(made.state, made.ctx, troop, "attachment")).toBe(true);
    expect(attachBlocked(made.state, made.ctx, troop, FRENZIED_CREATURE)).toBe(false);
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, SNIPER), "attachment")).toBe(false);
  });

  it("18020:A:2 gives nothing to a non-Goblin, to itself, from the staging area, or to a Goblin engaged with the other player", () => {
    const made = tableFromLayout(SCENARIO, { engaged: [GOBLIN_TROOP, HILL_TROLL] });
    const at = (table: typeof made, code: string, name: "attack" | "defense") => statOf({ state: table.state, steps: [] }, table.ctx, code, name);
    expect([at(made, HILL_TROLL, "attack"), at(made, HILL_TROLL, "defense")]).toEqual([6, 3]);
    expect([at(made, GOBLIN_TROOP, "attack"), at(made, GOBLIN_TROOP, "defense")]).toEqual([5, 4]);
    const staged = tableFromLayout(SCENARIO, { staging: [GOBLIN_TROOP], engaged: [SNIPER] });
    expect(at(staged, SNIPER, "attack")).toBe(2);
    const apart = tableFromLayout(SCENARIO, { seats: 2, engaged: [GOBLIN_TROOP, { code: SNIPER, seat: 1 }] });
    expect(at(apart, SNIPER, "attack")).toBe(2);
  });

  it("18021:A:2 engages the second player when he is the one who engages an enemy", () => {
    const made = tableFromLayout(SCENARIO, { seats: 2, phase: "Encounter", staging: [STRAY_GOBLIN, WOLF_RIDER] });
    let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = finish(send(run, { type: "Engage", enemyId: idOf(run.state, WOLF_RIDER) }, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, WOLF_RIDER)]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(run.state.cards[idOf(run.state, STRAY_GOBLIN)]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("18022:A:1 attacks once when its shadow card has an effect", () => {
    const done = played({}, attack(PACK_OF_WARGS, { shadow: WOODED_RIVERBANK, undefended: true }));
    expect(done.run.state.cards[done.table.hero]?.damage).toBe(4);
  });

  it("18023:A:2 ends its -1 Threat at the end of the phase", () => {
    const done = played({ phase: "Quest", staging: [HILLS], deck: ["f0"] }, [respond(HILLS), answer("dh2"), { act: "endPhase" }]);
    expect(done.run.state.phase).not.toBe("Quest");
    expect(statOf(done.run, done.table.ctx, HILLS, "threat")).toBe(2);
  });

  it("18023:A:2 is offered to the first player only, and only in the quest phase", () => {
    const made = tableFromLayout(SCENARIO, { seats: 2, firstPlayer: 1, phase: "Quest", staging: [HILLS] });
    const hills = idOf(made.state, HILLS);
    const offeredTo = (seat: number) => legalIntents({ ...start(made.state).state, activeSeat: seat }, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === hills);
    expect(offeredTo(0)).toBe(false);
    expect(offeredTo(1)).toBe(true);
    const planning = tableFromLayout(SCENARIO, { phase: "Planning", staging: [HILLS] });
    expect(legalIntents(start(planning.state).state, planning.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(planning.state, HILLS))).toBe(false);
  });

  it("18024:A:2 places an event played in the quest phase facedown under it while it is in the staging area, +2 Threat", () => {
    const made = tableFromLayout(SCENARIO, { phase: "Quest", staging: [LONELY_LANDS], hand: ["filler"] });
    const lands = idOf(made.state, LONELY_LANDS);
    const intent = legalIntents(start(made.state).state, made.ctx).find((offered) => offered.type === "PlayCard");
    expect(intent).toBeDefined();
    const run = finish(send(start(made.state), { ...intent!, payments: [] } as PlayerIntent, made.ctx), made.ctx);
    const filler = run.state.cards[idOf(run.state, "filler")];
    expect(filler).toMatchObject({ zone: "under", host: lands, face: "down" });
    expect(statOf(run, made.ctx, LONELY_LANDS, "threat")).toBe(4);
  });

  it("18024:A:2 does not take an event played while it is the active location", () => {
    const made = tableFromLayout(SCENARIO, { phase: "Quest", active: LONELY_LANDS, hand: ["filler"] });
    const intent = legalIntents(start(made.state).state, made.ctx).find((offered) => offered.type === "PlayCard");
    const run = finish(send(start(made.state), { ...intent!, payments: [] } as PlayerIntent, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, "filler")]?.zone).toBe("discard");
  });
});

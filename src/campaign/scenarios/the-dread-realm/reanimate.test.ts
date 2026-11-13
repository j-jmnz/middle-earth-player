// Rules: mec108.reanimated-dead, rr.engaged, rr.setup, rr.destroy, rr.shadow-effects, rr.step-6-2, rr.first-player, rr.travel, rr.cost, rr.reveal, rr.explored, rr.attachment-cards, rr.removed-from-game, faq.enemy-attacks-outside-combat (data/rules/entries.json)
// ledger lines 10150:A:1, 10155:A:1, 10155:A:2, 101156:A:1, 101157:A:1, 101158:A:1, 101158:A:2, 101159:A:1, 101159:A:2, 101160:A:1, 101160:A:2, 101161:A:1, 101161:A:2, 101162:A:2, 101164:A:1, 101164:A:2. The cards that reanimate or deal shadow cards, on tables built from a layout.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard, modifiedStat } from "../../../rules/core/keywords.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, shadowCards, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { dealShadowUnpayable } from "../../../rules/families/angmar/shadows.ts";
import { enemyCard, fightEnemy, finish, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-dread-realm";
const WITCH = "101156";
const WRAITH = "101157";
const DUNGEON = "101158";
const TOMBS = "101159";
const HALLS = "101160";
const CRYPT = "101161";
const POSSESSION = "101162";
const CALAMITY = "101164";
const DWIMMERLAIK = "10155";
const ENCOUNTER = ["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0"];

const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, { seats: 2, deck: ENCOUNTER, ...layout });
const settled = (state: ScenarioState, t: { ctx: Parameters<typeof settle>[1] }, steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, steps);
const deadOf = (state: ScenarioState, seat: number): string[] => state.seats[seat]?.engaged.filter((id) => state.cards[id]?.code.endsWith("~dead")) ?? [];

describe("10150:A:1 Setup reveals and reanimates", () => {
  it("10150:A:1 has each player reveal an encounter card into the staging area, then reanimate the top card of their deck", () => {
    const t = built({ deckOf: ["filler", "event"], staging: [] });
    const run = resolveRecords(t.state, t.ctx, "10150", "setup", idOf(t.state, "10150"));
    expect(run.state.staging.filter((id) => run.state.cards[id]?.code === "f0")).toHaveLength(2);
    for (const seat of [0, 1]) expect(deadOf(run.state, seat), `seat ${seat}`).toHaveLength(1);
    expect(run.state.seats[0].deck).toHaveLength(t.state.seats[0].deck.length - 1);
  });
});

describe("a Dwimmerlaik or an Unholy Crypt that destroys a character", () => {
  it("10155:A:1 reanimates the character the attack destroyed in front of the defending player and deals it 1 shadow card", () => {
    const fight = fightEnemy(built, "f0", DWIMMERLAIK, {}, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const hero = fight.made.hero;
    expect(fight.run.state.cards[hero]?.code).toContain("~dead");
    expect(fight.run.state.seats[0].engaged).toContain(hero);
    expect(shadowCards(fight.run.state.cards[hero])).toHaveLength(1);
  });
});

describe("Dwimmerlaik's Forced names the defending player", () => {
  it("10155:A:1 has the defending player (not the first player) reanimate the character it destroyed, in front of that player, while the other seat holds the first player token", () => {
    const fight = fightEnemy(built, "f0", DWIMMERLAIK, { firstPlayer: 1 }, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const hero = fight.made.hero;
    expect(fight.run.state.cards[hero]?.code).toContain("~dead");
    expect(fight.run.state.seats[0].engaged).toContain(hero);
    expect(fight.run.state.seats[1].engaged).not.toContain(hero);
    expect(shadowCards(fight.run.state.cards[hero])).toHaveLength(1);
  });
});

describe("a sentinel ally of another player that falls to the attack", () => {
  // Player 2's sentinel ally defends an attack on Player 1: the defending player is Player 1, so the dead engages Player 1 and is still Player 2's card.
  const sentinel = (made: ReturnType<typeof built>) => made.cards.set("ally", { ...made.cards.get("ally")!, defense: 0, keywords: { ...made.cards.get("ally")!.keywords, sentinel: true } });
  const sentinelFight = (shadow: string, enemy: string) =>
    fightEnemy(
      (layout: Layout) => {
        const made = built(layout);
        sentinel(made);
        return made;
      },
      shadow,
      enemy,
      { seats: 2, play: [{ code: "ally", seat: 1 }] },
      { defender: (made) => idOf(made.state, "ally"), tweak: (state, made) => updateCard(state, idOf(made.state, "ally"), { damage: 1 }) },
    );

  it("10155:A:1 has the defending player, not the controller of the ally that fell, take the Reanimated Dead", () => {
    const fight = sentinelFight("f0", DWIMMERLAIK);
    const ally = idOf(fight.made.state, "ally");
    expect(fight.run.state.cards[ally]?.code).toBe("ally~dead");
    expect(fight.run.state.cards[ally]?.owner).toBe(1);
    expect(fight.run.state.seats[0].engaged).toContain(ally);
    expect(fight.run.state.seats[1].engaged).not.toContain(ally);
    expect(shadowCards(fight.run.state.cards[ally])).toHaveLength(1);
  });

  it("101161:A:2 (and 10155:A:2) has the Unholy Crypt's shadow engage the defending player the same way", () => {
    for (const shadowCard of [CRYPT, DWIMMERLAIK]) {
      const fight = sentinelFight(shadowCard, "f0");
      const ally = idOf(fight.made.state, "ally");
      expect(fight.run.state.cards[ally]?.code, shadowCard).toBe("ally~dead");
      expect(fight.run.state.seats[0].engaged, shadowCard).toContain(ally);
      expect(fight.run.state.seats[1].engaged, shadowCard).not.toContain(ally);
    }
  });
});

describe("Unholy Crypt and Dark Halls", () => {
  it("101161:A:2 reanimates the character the attack destroyed (its shadow effect)", () => {
    const fight = fightEnemy(built, CRYPT, "f0", {}, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const hero = fight.made.hero;
    expect(fight.run.state.cards[hero]?.code).toContain("~dead");
    expect(shadowCards(fight.run.state.cards[hero])).toHaveLength(1);
  });

  it("10155:A:2 prints the Unholy Crypt's shadow text, so a Dwimmerlaik dealt as a shadow card reanimates the character the attack destroyed", () => {
    const fight = fightEnemy(built, DWIMMERLAIK, "f0", {}, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    expect(fight.run.state.cards[fight.made.hero]?.code).toContain("~dead");
    expect(shadowCards(fight.run.state.cards[fight.made.hero])).toHaveLength(1);
  });

  it("101161:A:2 reanimates nothing when the attack destroys no character", () => {
    const fight = fightEnemy(built, CRYPT, "f0", {}, { undefended: true });
    expect(fight.run.state.seats[0].engaged.some((id) => fight.run.state.cards[id]?.code.endsWith("~dead"))).toBe(false);
  });

  it("101161:A:1 gets +1 Threat for each Reanimated Dead in play, engaged or in the staging area, any player's", () => {
    const t = built({ staging: [CRYPT], deckOf: ["filler"] });
    const id = idOf(t.state, CRYPT);
    const base = modifiedStat(t.state, t.state.cards[id]!, "threat", t.cards);
    const one = runInstruction(t.state, { verb: "Reanimate", from: "deckTop" }, { seat: 0, sourceId: null }, t.ctx, []);
    const two = runInstruction(one, { verb: "Reanimate", from: "deckTop", to: "staging" }, { seat: 1, sourceId: null }, t.ctx, []);
    expect(modifiedStat(settled(one, t), settled(one, t).cards[id]!, "threat", t.cards)).toBe(base + 1);
    expect(modifiedStat(settled(two, t), settled(two, t).cards[id]!, "threat", t.cards)).toBe(base + 2);
  });

  it("101160:A:1 gives each Reanimated Dead +1 Attack and +1 Defense for each copy of Dark Halls in the staging area, and none when it is not staged", () => {
    const t = built({ staging: [HALLS, HALLS], deckOf: ["filler"] });
    const reanimated = settled(runInstruction(t.state, { verb: "Reanimate", from: "deckTop" }, { seat: 0, sourceId: null }, t.ctx, []), t);
    const dead = reanimated.cards[deadOf(reanimated, 0)[0]!]!;
    expect(modifiedStat(reanimated, dead, "attack", t.cards)).toBe(4);
    expect(modifiedStat(reanimated, dead, "defense", t.cards)).toBe(4);
    const away = built({ deckOf: ["filler"] });
    const plain = settled(runInstruction(away.state, { verb: "Reanimate", from: "deckTop" }, { seat: 0, sourceId: null }, away.ctx, []), away);
    expect(modifiedStat(plain, plain.cards[deadOf(plain, 0)[0]!]!, "attack", away.cards)).toBe(2);
  });

  it("101160:A:2 reanimates a copy of the defending character from the defending player's discard pile and deals it 1 shadow card, and a different card in the pile does not count", () => {
    const withPile = (code: string) =>
      fightEnemy(built, HALLS, "f0", { play: ["ally"] }, { defender: (made) => idOf(made.state, "ally"), tweak: (state) => spawn(state, code, { zone: "discard", seat: 0 }).state });
    const fight = withPile("ally");
    const dead = deadOf(fight.run.state, 0);
    expect(dead).toHaveLength(1);
    expect(fight.run.state.cards[dead[0]!]?.code).toBe("ally~dead");
    expect(shadowCards(fight.run.state.cards[dead[0]!])).toHaveLength(1);
    expect(deadOf(withPile("event").run.state, 0)).toHaveLength(0);
  });
});

describe("Witch of Angmar, Sinister Dungeon and Death and Calamity", () => {
  it("101156:A:1 resolves the 'when revealed' effects of the Sorcery shadow cards dealt to the Witch after their shadow effects, and does nothing for another shadow card", () => {
    const fight = fightEnemy(built, CALAMITY, WITCH, { deckOf: ["filler", "filler", "filler"] }, { undefended: true });
    const calamity = idOf(fight.run.state, CALAMITY);
    expect(fight.run.state.cards[calamity]).toMatchObject({ zone: "attached", host: fight.run.state.questStage });
    expect(deadOf(fight.run.state, 0)).toHaveLength(1);
    const plain = fightEnemy(built, "f0", WITCH, { deckOf: ["filler"] }, { undefended: true });
    expect(deadOf(plain.run.state, 0)).toHaveLength(0);
  });

  it("101164:A:1 attaches Death and Calamity to the current quest, then the first player reanimates the top X cards of their deck, X the copies in play", () => {
    const t = built({ deckOf: ["filler", "filler", "filler"] });
    const one = resolveRecords(t.state, t.ctx, CALAMITY, "whenRevealed");
    expect(one.state.cards[one.id]).toMatchObject({ zone: "attached", host: t.state.questStage });
    expect(deadOf(one.state, 0)).toHaveLength(1);
    const two = built({ deckOf: ["filler", "filler", "filler"], attached: [{ code: CALAMITY, to: "10150" }] });
    const both = resolveRecords(two.state, two.ctx, CALAMITY, "whenRevealed");
    expect(deadOf(both.state, 0)).toHaveLength(2);
    expect(deadOf(both.state, 1)).toHaveLength(0);
  });

  it("101164:A:1 reanimates nothing when the attach did not happen (rr.then): with no current quest to hold it, the first player's deck is left alone", () => {
    const t = built({ deckOf: ["filler", "filler", "filler"] });
    const noQuest = { ...t.state, questStage: null };
    const run = resolveRecords(noQuest, t.ctx, CALAMITY, "whenRevealed");
    expect(run.state.cards[run.id]?.zone).not.toBe("attached");
    expect(deadOf(run.state, 0)).toHaveLength(0);
    expect(run.state.seats[0].deck).toHaveLength(t.state.seats[0].deck.length);
  });

  it("101157:A:1 takes 1 Willpower, Attack and Defense only from an attached character: on a host that is no character the Wraith gives nothing", () => {
    const t = built({ staging: [DWIMMERLAIK], attached: [{ code: WRAITH, to: DWIMMERLAIK }, { code: WRAITH, to: "dh1" }] });
    const wraiths = Object.values(t.state.cards).filter((card) => card.code === WRAITH);
    const onEnemy = wraiths.find((card) => t.state.cards[card.host ?? ""]?.code === DWIMMERLAIK)!;
    const onHero = wraiths.find((card) => card.id !== onEnemy.id)!;
    const synced = settled(updateCard(updateCard(t.state, onEnemy.id, { zone: "attached", asAttachment: true }), onHero.id, { zone: "attached", asAttachment: true }), t);
    expect(modifiedStat(synced, synced.cards[onEnemy.host!]!, "attack", t.cards)).toBe(5);
    const hero = synced.cards[onHero.host!]!;
    expect(modifiedStat(synced, hero, "defense", t.cards)).toBe(Math.max(0, (t.cards.get(hero.code)!.defense ?? 0) - 1));
  });

  it("101164:A:2 gives the attacking enemy +X Attack, X the Sorcery cards in play, the shadow card itself not counted", () => {
    const plain = fightEnemy(built, CALAMITY, "f0", {}, { undefended: true });
    const sorcery = fightEnemy(built, CALAMITY, "f0", { attached: [{ code: CALAMITY, to: "10150" }, { code: CALAMITY, to: "10150" }] }, { undefended: true });
    expect(plain.run.state.cards[plain.made.hero]?.damage).toBe(1);
    expect(sorcery.run.state.cards[sorcery.made.hero]?.damage).toBe(3);
  });

  it("101158:A:1 deals Sinister Dungeon, once explored, facedown to the Reanimated Dead made from a random card of the first player's hand; an empty hand leaves it in the discard pile", () => {
    const t = built({ staging: [DUNGEON], hand: ["filler"] });
    const id = idOf(t.state, DUNGEON);
    const watched = settled(t.state, t);
    const explored = finish({ state: settled(destroyCard(watched, id, t.ctx.cards, [], true), t), steps: [] }, t.ctx);
    const dead = deadOf(explored.state, 0);
    expect(dead).toHaveLength(1);
    expect(explored.state.cards[id]).toMatchObject({ zone: "shadow", host: dead[0], face: "down" });
    expect(explored.state.encounterDiscard).not.toContain(id);
    const bare = built({ staging: [DUNGEON] });
    const none = settled(destroyCard(settled({ ...bare.state, seats: [{ ...bare.state.seats[0], hand: [] }, bare.state.seats[1]] }, bare), idOf(bare.state, DUNGEON), bare.ctx.cards, [], true), bare);
    expect(none.cards[idOf(bare.state, DUNGEON)]?.zone).toBe("encounterDiscard");
    expect(deadOf(none, 0)).toHaveLength(0);
  });

  it("101158:A:2 discards the top 2 cards of the encounter deck and resolves the 'when revealed' effects of each Sorcery card among them", () => {
    const fight = fightEnemy(built, DUNGEON, "f0", { deck: [DUNGEON, CALAMITY, "f0", "f0"], deckOf: ["filler", "filler"] }, { undefended: true });
    const state = fight.run.state;
    expect(state.cards[idOf(state, CALAMITY)]).toMatchObject({ zone: "attached", host: state.questStage });
    expect(deadOf(state, 0)).toHaveLength(1);
    expect(state.encounterDiscard.some((id) => state.cards[id]?.code === "f0")).toBe(true);
  });
});

describe("Tombs of Carn Dûm", () => {
  it("101159:A:1 has each player discard the top card of their deck and reanimate it when it is an ally: an ally is reanimated, any other card stays in the discard pile", () => {
    const t = built({ deckOf: [{ code: "ally", seat: 0 }, { code: "event", seat: 0 }, { code: "event", seat: 1 }, { code: "ally", seat: 1 }] });
    const run = resolveRecords(t.state, t.ctx, TOMBS, "forced");
    expect(deadOf(run.state, 0)).toHaveLength(1);
    expect(deadOf(run.state, 1)).toHaveLength(0);
    expect(run.state.seats[1].discard.map((id) => run.state.cards[id]?.code)).toEqual(["event"]);
    expect(run.state.seats[0].discard).toHaveLength(0);
  });

  it("101159:A:2 deals 1 shadow card to each Undead enemy in play, a Reanimated Dead included, and cannot be paid unless the encounter deck holds a card for each", () => {
    const base = built({ staging: ["f0"], deckOf: ["filler"] });
    base.cards.set("undead", enemyCard("undead", { traits: ["Undead"], engagementCost: 50, attack: 1, defense: 1, health: 3 }));
    const t = { ...base, state: spawn(base.state, "undead", { zone: "staging" }).state };
    const travel = t.ctx.effects.find((effect) => effect.cardCode === TOMBS && effect.timing === "travel")!.instructions[0]!;
    const run = runInstruction(t.state, { verb: "Reanimate", from: "deckTop" }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(dealShadowUnpayable(run, travel, t.ctx)).toBe(false);
    const dealt = runInstruction(run, travel, { seat: 0, sourceId: null }, t.ctx, []);
    expect(shadowCards(dealt.cards[idOf(dealt, "undead")])).toHaveLength(1);
    expect(shadowCards(dealt.cards[idOf(dealt, "f0")])).toHaveLength(0);
    expect(shadowCards(dealt.cards[deadOf(dealt, 0)[0]!])).toHaveLength(1);
    expect(dealShadowUnpayable({ ...run, encounterDeck: run.encounterDeck.slice(0, 1) }, travel, t.ctx)).toBe(true);
  });
});

describe("Possession and the Wraith of Carn Dûm", () => {
  it("101162:A:2 destroys the highest cost ally, its owner reanimates it into the staging area and Possession attaches to it, the first player breaking a tie", () => {
    const t = built({ play: ["10179", "10178", "10176"] });
    const run = resolveRecords(t.state, t.ctx, POSSESSION, "whenRevealed");
    const dead = Object.values(run.state.cards).find((card) => card.code === "10179~dead")!;
    expect(dead).toMatchObject({ zone: "staging", owner: 0, face: "down" });
    expect(run.state.cards[run.id]).toMatchObject({ zone: "attached", host: dead.id });
    expect(Object.values(run.state.cards).some((card) => card.code === "10176" && card.zone === "play")).toBe(true);
    const tied = built({ play: ["ally", "10176"] });
    const asked = resolveRecords(tied.state, tied.ctx, POSSESSION, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options[1] ?? "") : ""));
    expect(Object.values(asked.state.cards).filter((card) => card.code.endsWith("~dead"))).toHaveLength(1);
  });

  it("101162:A:2 discards the Reanimated Dead with Possession, but not when Possession is removed from the game", () => {
    const t = built({ play: ["10179"] });
    const run = resolveRecords(t.state, t.ctx, POSSESSION, "whenRevealed");
    const synced = settled(run.state, t);
    const host = Object.values(synced.cards).find((card) => card.code === "10179~dead")!;
    const discarded = settled(destroyCard(synced, run.id, t.ctx.cards, []), t);
    expect(discarded.cards[host.id]).toMatchObject({ code: "10179", zone: "discard" });
    expect(discarded.seats[0].discard).toContain(host.id);
    const removed = settled(moveCard(synced, run.id, { zone: "removed" }), t);
    expect(removed.cards[host.id]).toMatchObject({ code: "10179~dead", zone: "staging" });
  });

  it("101162:A:2 has the destroyed ally's controller reanimate it, an ally of the other seat included, whoever the effect runs for", () => {
    // The effect runs for seat 0, who is out of the game: only the controller of the ally (seat 1) can reanimate it.
    const t = built({ play: [{ code: "10179", seat: 1 }] });
    const out = { ...t.state, seats: [{ ...t.state.seats[0], eliminated: true }, t.state.seats[1]] as ScenarioState["seats"] };
    const run = resolveRecords(out, t.ctx, POSSESSION, "whenRevealed");
    const dead = Object.values(run.state.cards).find((card) => card.code === "10179~dead")!;
    expect(dead).toMatchObject({ zone: "staging", owner: 1 });
    expect(run.state.seats[1].discard).not.toContain(dead.id);
    expect(run.state.cards[run.id]).toMatchObject({ zone: "attached", host: dead.id });
  });

  it("101162:A:2 counts as a Condition attachment as well as a Sorcery card, so an effect discarding a Condition attachment finds it", () => {
    const t = built({ play: ["10179"] });
    const run = resolveRecords(t.state, t.ctx, POSSESSION, "whenRevealed");
    const synced = settled(run.state, t);
    const found = pickCandidates(synced, { type: "attachment", control: "any", trait: "Condition" }, 0, [], null, t.ctx);
    expect(found).toContain(run.id);
    expect(hasTrait(synced, run.id, "Condition", t.ctx)).toBe(true);
    expect(hasTrait(synced, run.id, "Sorcery", t.ctx)).toBe(true);
  });

  it("101157:A:1 attaches the Wraith to a character when it leaves play, as a Sorcery attachment taking 1 from Willpower, Attack and Defense, and returns it to the staging area as an enemy when that character leaves play", () => {
    const t = built({ staging: [WRAITH], play: ["10179"] });
    const id = idOf(t.state, WRAITH);
    const ally = idOf(t.state, "10179");
    const watched = settled(t.state, t);
    const left = finish({ state: settled(destroyCard(watched, id, t.ctx.cards, []), t), steps: [] }, t.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === ally) ?? state.window.options[0] ?? "") : ""));
    const attachedTo = left.state.cards[id]!.host;
    expect(left.state.cards[id]).toMatchObject({ zone: "attached", asAttachment: true });
    expect(hasTrait(left.state, id, "Sorcery", t.ctx)).toBe(true);
    const host = left.state.cards[attachedTo!]!;
    const printed = t.cards.get(host.code)!;
    for (const stat of ["willpower", "attack", "defense"] as const) expect(modifiedStat(left.state, host, stat, t.cards), stat).toBe(Math.max(0, (printed[stat] ?? 0) - 1));
    const orphaned = settled(destroyCard(left.state, attachedTo!, t.ctx.cards, []), t);
    expect(orphaned.cards[id]).toMatchObject({ zone: "staging", face: "up" });
    expect(orphaned.cards[id]?.asAttachment).toBeUndefined();
    expect(orphaned.encounterDiscard).not.toContain(id);
    // Discarded as an attachment by an effect, it is simply discarded and attaches nowhere.
    const discarded = settled(destroyCard(left.state, id, t.ctx.cards, []), t);
    expect(discarded.cards[id]?.zone).toBe("encounterDiscard");
  });

  it("101157:A:1 attaches to nothing when no character is in play, and leaves play as it was going", () => {
    const t = built({ staging: [WRAITH] });
    const id = idOf(t.state, WRAITH);
    const noHeroes = { ...t.state, seats: [{ ...t.state.seats[0], heroes: [] }, { ...t.state.seats[1], heroes: [] }] as ScenarioState["seats"] };
    const left = settled(destroyCard(settled(noHeroes, t), id, t.ctx.cards, []), t);
    expect(left.cards[id]?.zone).toBe("encounterDiscard");
  });
});

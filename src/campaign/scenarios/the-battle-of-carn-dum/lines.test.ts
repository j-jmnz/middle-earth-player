// Rules: mec108.thaurdir, mec108.indestructible, rr.step-6-2, rr.shadow-effects, rr.travel, rr.cost, rr.search, rr.printed, faq.enemy-attacks-outside-combat, faq.additional-attacks, faq.progress-without-advancing (data/rules/entries.json)
// ledger lines 10125:B:2, 10125:B:3, 10126:A:1, 10126:B:1, 10126:B:2, 10127:A:4, 10128:A:4, 10130:A:2, 10131:A:1, 10131:A:2, 10133:A:1, 10134:A:2, 10136:A:1, 10137:A:1, 10137:A:2, 10192:A:1. The angmar family's verbs for The Battle of Carn Dûm on tables built
// from a layout: Thaurdir's two sides, the shadow cards dealt outside an attack, Orc Grunts, Mountains of Angmar and the copies of a card a deck holds.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, shadowCards } from "../../../rules/core/zones.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { resolveAmount } from "../../../rules/interpret/amounts.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { placeQuestProgress, questStatOf } from "../../../rules/quest/quest.ts";
import { setCurrentQuest } from "../../../rules/families/angmar/quest.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { discardShadows } from "../../../rules/combat/shadow.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { fightEnemy, finish, idOf, legalIntents, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { seatThreat } from "../../../rules/families/play/hooks.ts";
import { travelUnpayable } from "../../../rules/families/angmar/travel.ts";

const SCENARIO = "the-battle-of-carn-dum";
const CAPTAIN = "10127";
const CHAMPION = "10128";
const GARRISON = "10129";
const GRUNTS = "10130";
const WEREWOLF = "10131";
const ACTIVE_FLAGS = ["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0"];

const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, { deck: ACTIVE_FLAGS, ...layout });
const scope = { actor: 0, sourceId: null, returned: 0 } as const;
const canAdvance = () => true;
const shadowsOn = (state: ScenarioState, code: string): number => shadowCards(state.cards[idOf(state, code)]).length;
// Runs the pending announcements and the Forced effects they start to the end.
const settled = (state: ScenarioState, t: { ctx: Parameters<typeof settle>[1] }, steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, steps);

describe("Thaurdir's two sides (FlipTwoSided)", () => {
  it("10127:A:4 flips Captain to Champion and back keeping his damage, shadow cards and attachment, and the new side hears that it was flipped", () => {
    const t = built({ stage: "10125", staging: [{ code: CAPTAIN, damage: 2 }, GARRISON], attached: [{ code: "10168", to: CAPTAIN }] });
    const id = idOf(t.state, CAPTAIN);
    const dealt = runInstruction(t.state, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: id }, t.ctx, []);
    const flipped = runInstruction(dealt, { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(flipped.cards[id]).toMatchObject({ code: CHAMPION, damage: 2, other: CAPTAIN });
    expect(shadowCards(flipped.cards[id])).toHaveLength(1);
    expect(flipped.cards[id]?.attachments).toHaveLength(1);
    expect(flipped.pendingEvents).toContainEqual({ trigger: "flippedOver", seat: null, cardId: id });
    const back = runInstruction(flipped, { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(back.cards[id]?.code).toBe(CAPTAIN);
    // Neither side in play: nothing happens.
    expect(runInstruction(built().state, { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION }, { seat: 0, sourceId: null }, t.ctx, [])).toEqual(built().state);
  });

  it("10127:A:4 deals each enemy in play, the staging area's and the engaged ones, 1 shadow card when Thaurdir flips to Captain, and none to a card that is not an enemy", () => {
    const t = built({ stage: "10125", staging: [CHAMPION, GARRISON, "f3", "place"], engaged: [GRUNTS] });
    const flipped = runInstruction(t.state, { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION }, { seat: 0, sourceId: null }, t.ctx, []);
    const done = settled(flipped, t);
    expect(done.cards[idOf(done, CAPTAIN)]?.code).toBe(CAPTAIN);
    for (const code of [CAPTAIN, GARRISON, "f3", GRUNTS]) expect(shadowsOn(done, code), code).toBe(1);
    expect(shadowsOn(done, "place")).toBe(0);
    expect(done.encounterDeck).toHaveLength(ACTIVE_FLAGS.length - 4);
  });

  it("10127:A:4 deals nothing more once the encounter deck is empty", () => {
    const t = built({ stage: "10125", staging: [CAPTAIN, GARRISON], deck: ["f0"] });
    const dealt = runInstruction(t.state, { verb: "DealShadowInPlay" }, { seat: 0, sourceId: idOf(t.state, CAPTAIN) }, t.ctx, []);
    expect(dealt.cards[idOf(dealt, CAPTAIN)]?.shadowId ?? dealt.cards[idOf(dealt, GARRISON)]?.shadowId).toBeTruthy();
    expect(shadowCards(dealt.cards[idOf(dealt, CAPTAIN)])).toHaveLength(1);
    expect(shadowCards(dealt.cards[idOf(dealt, GARRISON)])).toHaveLength(0);
  });
});

describe("shadow cards dealt to an enemy (shadowDealtTo)", () => {
  it("10125:B:3 flips Thaurdir as the third shadow card is dealt to him, once, and not at 1 or 2; the Champion side then attacks the first player (10128:A:4)", () => {
    const t = built({ stage: "10125", staging: [CAPTAIN, GARRISON], deck: ACTIVE_FLAGS });
    const id = idOf(t.state, CAPTAIN);
    let state = t.state;
    const sides: string[] = [];
    for (let count = 1; count <= 3; count += 1) {
      state = settled(runInstruction(state, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: id }, t.ctx, []), t);
      sides.push(`${count}:${state.cards[id]?.code}`);
    }
    expect(sides).toEqual(["1:10127", "2:10127", "3:10128"]);
    // The flip announced itself to the Champion side, whose Forced effect made the attack on the first player.
    expect(state.pendingAttack?.enemyId).toBe(id);
    expect(state.pendingAttack?.seat).toBe(0);
  });

  it("10131:A:2 engages the first player and attacks as the Werewolf of Angmar is dealt its third shadow card in the staging area, and does not while it is engaged", () => {
    const staged = built({ phase: "Combat", staging: [WEREWOLF], deck: ACTIVE_FLAGS });
    const id = idOf(staged.state, WEREWOLF);
    let state = staged.state;
    for (let count = 0; count < 2; count += 1) state = settled(runInstruction(state, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: id }, staged.ctx, []), staged);
    expect(state.cards[id]?.zone).toBe("staging");
    state = runInstruction(state, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: id }, staged.ctx, []);
    state = settle({ ...state, window: null }, staged.ctx, []);
    expect(state.cards[id]?.zone).toBe("engaged");
    expect(state.pendingAttack?.enemyId).toBe(id);
    // The three cards resolve: no new shadow card is dealt for this attack.
    expect(shadowsOn(state, WEREWOLF)).toBe(3);
    const engaged = built({ phase: "Combat", engaged: [WEREWOLF], deck: ACTIVE_FLAGS });
    let held = engaged.state;
    for (let count = 0; count < 3; count += 1) held = settled(runInstruction(held, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: idOf(held, WEREWOLF) }, engaged.ctx, []), engaged);
    expect(held.cards[idOf(held, WEREWOLF)]?.zone).toBe("engaged");
    expect(held.pendingAttack).toBeFalsy();
  });
});

describe("the amount shadowCardsInPlay and the Travel cost that deals them", () => {
  it("10126:A:1 counts every shadow card dealt to the enemies in the staging area and engaged", () => {
    const t = built({ stage: "10126", staging: [CAPTAIN, GARRISON], engaged: [GRUNTS] });
    expect(resolveAmount(t.state, { shadowCardsInPlay: true }, scope, t.ctx)).toBe(0);
    const dealt = runInstruction(t.state, { verb: "DealShadowInPlay" }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(resolveAmount(dealt, { shadowCardsInPlay: true }, scope, t.ctx)).toBe(3);
    const more = runInstruction(dealt, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: idOf(dealt, GARRISON) }, t.ctx, []);
    expect(resolveAmount(more, { shadowCardsInPlay: true }, scope, t.ctx)).toBe(4);
  });

  it("10134:A:2 cannot be paid when the encounter deck holds fewer cards than there are enemies in play", () => {
    const t = built({ staging: [GARRISON, "f3"], engaged: [GRUNTS], deck: ["f0", "f0"] });
    const line = { verb: "DealShadowInPlay" } as const;
    expect(travelUnpayable(t.state, line, t.ctx, "x")).toBe(true);
    const enough = built({ staging: [GARRISON, "f3"], engaged: [GRUNTS], deck: ["f0", "f0", "f0"] });
    expect(travelUnpayable(enough.state, line, enough.ctx, "x")).toBe(false);
    // A line with a target is no cost on every enemy.
    expect(travelUnpayable(t.state, { verb: "DealShadowInPlay", target: "self" }, t.ctx, "x")).toBe(false);
  });
});

describe("keepShadowCards (stage 1B)", () => {
  it("10125:B:2 keeps the facedown shadow cards at the end of the combat phase and discards a card an attack turned up, and without the stage it discards all", () => {
    const t = built({ stage: "10125", staging: [GARRISON], engaged: [GRUNTS] });
    expect(flagged(t.state, "table", "keepShadowCards")).toBe(true);
    const dealt = runInstruction(t.state, { verb: "DealShadowInPlay" }, { seat: 0, sourceId: null }, t.ctx, []);
    const grunts = idOf(dealt, GRUNTS);
    const resolved = updateCard(dealt, dealt.cards[grunts]?.shadowId ?? "", { face: "up" });
    const after = discardShadows(resolved);
    expect(shadowCards(after.cards[idOf(after, GARRISON)])).toHaveLength(1);
    expect(shadowCards(after.cards[grunts])).toHaveLength(0);
    const plain = built({ stage: "10126", staging: [GARRISON], engaged: [GRUNTS] });
    expect(flagged(plain.state, "table", "keepShadowCards")).toBe(false);
    const dealtPlain = runInstruction(plain.state, { verb: "DealShadowInPlay" }, { seat: 0, sourceId: null }, plain.ctx, []);
    const cleared = discardShadows(dealtPlain);
    expect(shadowsOn(cleared, GARRISON) + shadowsOn(cleared, GRUNTS)).toBe(0);
  });
});

describe("Orc Grunts (questProgressReduced)", () => {
  it("10130:A:2 reduces the progress placed on the current quest by 1 for each Orc Grunts in play, never below 0, and not the progress an active location takes", () => {
    const none = built({ staging: ["f3"] });
    expect(placeQuestProgress(none.state, 4, none.cards, [], canAdvance).cards[none.state.questStage ?? ""]?.progress).toBe(4);
    const one = built({ staging: [GRUNTS] });
    expect(placeQuestProgress(one.state, 4, one.cards, [], canAdvance).cards[one.state.questStage ?? ""]?.progress).toBe(3);
    const two = built({ staging: [GRUNTS], engaged: [GRUNTS] });
    const placed = placeQuestProgress(two.state, 4, two.cards, [], canAdvance);
    expect(placed.cards[placed.questStage ?? ""]?.progress).toBe(2);
    const swamped = placeQuestProgress(two.state, 1, two.cards, [], canAdvance);
    expect(swamped.cards[swamped.questStage ?? ""]?.progress).toBe(0);
    const buffered = built({ staging: [GRUNTS], active: "10133" });
    const stepped = placeQuestProgress(buffered.state, 5, buffered.cards, [], canAdvance);
    const active = stepped.cards[idOf(stepped, "10133")];
    expect(active?.progress).toBe(5);
    expect(stepped.cards[stepped.questStage ?? ""]?.progress).toBe(0);
  });

  it("10130:A:2 does not reduce progress a player effect puts on the main quest card while a side quest is the current quest, and does while it is the current quest", () => {
    const t = built({ stage: "10125", staging: [GRUNTS, "10139"] });
    const effect: Effect = { id: "t:forced:1", cardCode: "f0", lines: [], timing: "forced", instructions: [{ verb: "Pick", pick: { type: "card", control: "any", questCard: true, names: ["The Clutches of Carn Dûm"] } }, { verb: "PlaceProgressOnQuestCard", amount: 4 }] };
    const run = (state: ScenarioState): number => {
      const pushed = pushCardEffects(state, "forced", idOf(state, GRUNTS), 0, false, [effect], t.ctx, []);
      const done = settled(pushed, t);
      return done.cards[done.questStage ?? ""]?.progress ?? -1;
    };
    expect(run(t.state)).toBe(3);
    expect(run(setCurrentQuest(t.state, idOf(t.state, "10139"), t.ctx))).toBe(4);
  });
});

describe("Mountains of Angmar (blankShadowGains)", () => {
  it("10133:A:1 raises the defending player's threat by 2 when a shadow card with no shadow effect is flipped, only while Mountains is the active location, and not for a card that has a shadow effect", () => {
    const threatAfter = (layout: Layout, shadow: string): number => {
      const fight = fightEnemy((made: Layout) => built(made), shadow, "f3", layout);
      return seatThreat(fight.run.state, 0) - seatThreat(fight.start, 0);
    };
    expect(flagged(built({ active: "10133" }).state, "table", "blankShadowGains")).toBe(true);
    expect(flagged(built().state, "table", "blankShadowGains")).toBe(false);
    expect(threatAfter({ active: "10133" }, "f0")).toBe(2);
    expect(threatAfter({}, "f0")).toBe(0);
    // Mountains' own shadow line raises it by 2 too, never by 4: it has a shadow effect of its own.
    expect(threatAfter({ active: "10133" }, "10133")).toBe(2);
  });
});

describe("the copies of a card in a deck (DiscardCopiesFromDeck, discardPileMaxCost)", () => {
  it("10136:A:1 discards each other copy of the card the player discarded and shuffles the deck, and does nothing when the card is not in the actor's discard pile", () => {
    const t = built({ deckOf: ["event", "event", "ally", "event"], discard: [] });
    const deck = t.state.seats[0]!.deck;
    const [first] = deck;
    const discarded = moveCard(t.state, first ?? "", { zone: "discard", seat: 0 });
    // The picked card is the last card the effect picked: a frame's list, set here the way DiscardRandomFromHand `remember` leaves it.
    const stack = { ...discarded, stack: [{ id: "f", frame: "forced", cardId: null, seat: 0, peril: false, step: 0, data: { kind: "effect", picked: [first ?? ""] } }] } as unknown as ScenarioState;
    const done = runInstruction(stack, { verb: "DiscardCopiesFromDeck", of: "picked", all: true, shuffle: true }, { seat: 0, sourceId: null }, t.ctx, []);
    const kept = done.seats[0]!.deck.map((id) => done.cards[id]?.code);
    expect(kept).toEqual(["ally"]);
    expect(done.seats[0]!.discard).toHaveLength(3);
    // One copy at a time without `all`.
    const one = runInstruction(stack, { verb: "DiscardCopiesFromDeck", of: "picked" }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(one.seats[0]!.deck.filter((id) => one.cards[id]?.code === "event")).toHaveLength(1);
    // The card is not in this seat's discard pile (an earlier seat's pick): nothing happens.
    const elsewhere = runInstruction({ ...stack, seats: [{ ...stack.seats[0]!, discard: [] }, stack.seats[1]!] as unknown as ScenarioState["seats"] }, { verb: "DiscardCopiesFromDeck", of: "picked", all: true }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(elsewhere.seats[0]!.deck).toHaveLength(3);
  });

  it("10137:A:1 reads the highest printed cost in the actor's discard pile, 0 for an empty pile or a hero", () => {
    const empty = built();
    expect(resolveAmount(empty.state, { discardPileMaxCost: true }, scope, empty.ctx)).toBe(0);
    const t = built({ deckOf: ["c1", "c3", "c2"] });
    let state = t.state;
    for (const id of t.state.seats[0]!.deck) state = moveCard(state, id, { zone: "discard", seat: 0 });
    expect(resolveAmount(state, { discardPileMaxCost: true }, scope, t.ctx)).toBe(3);
  });
});

describe("DiscardShadowOf with all", () => {
  it("10192:A:1 discards each shadow card dealt to the enemy, not just one", () => {
    const t = built({ staging: [GARRISON], deck: ACTIVE_FLAGS });
    const id = idOf(t.state, GARRISON);
    let state = t.state;
    for (let count = 0; count < 3; count += 1) state = runInstruction(state, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: id }, t.ctx, []);
    expect(shadowsOn(state, GARRISON)).toBe(3);
    const one = runInstruction(state, { verb: "DiscardShadowOf", target: "self" }, { seat: 0, sourceId: id }, t.ctx, []);
    expect(shadowsOn(one, GARRISON)).toBe(2);
    const all = runInstruction(state, { verb: "DiscardShadowOf", target: "self", all: true }, { seat: 0, sourceId: id }, t.ctx, []);
    expect(shadowsOn(all, GARRISON)).toBe(0);
  });
});

describe("Thaurdir on stage 2B (engagedWithAll)", () => {
  // Plays the encounter and combat phases to the end with every attack undefended and nothing declared; the attacks each enemy made, in order.
  const playCombat = (layout: Layout, prepare: (state: ScenarioState, table: ReturnType<typeof built>) => ScenarioState = (state) => state): { run: Run; attacks: string[]; shadowsAtAttack: number[] } => {
    const t = built({ phase: "Encounter", stage: "10126", ...layout });
    let run = send(start(prepare(t.state, t)), { type: "DeclineEngage" }, t.ctx);
    const attacks: string[] = [];
    const shadowsAtAttack: number[] = [];
    let seen = 0;
    for (let guard = 0; guard < 80 && run.state.phase !== "Refresh"; guard += 1) {
      for (; seen < run.steps.length; seen += 1) {
        const step = run.steps[seen];
        if (step?.kind === "attack" && step.side === "enemy") {
          attacks.push(`${run.state.cards[step.enemyId]?.code}@${step.seat}`);
          shadowsAtAttack.push(shadowCards(run.state.cards[step.enemyId]).length);
        }
      }
      const window = run.state.window;
      if (window?.kind === "defense") {
        run = send(run, { type: "Undefended", heroId: run.state.seats[window.seat]?.heroes[0] ?? "" }, t.ctx);
        continue;
      }
      if (window?.kind === "choose") {
        run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, t.ctx);
        continue;
      }
      if (window?.kind === "chooseEnemy") {
        run = send(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, t.ctx);
        continue;
      }
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
    return { run, attacks, shadowsAtAttack };
  };

  it("10126:B:1 makes Thaurdir attack each player once in turn from the staging area, with a shadow card of its own for each attack, and he engages nobody", () => {
    const { run, attacks, shadowsAtAttack } = playCombat({ seats: 2, staging: [CAPTAIN], deck: ACTIVE_FLAGS });
    // The two combat attacks, then the end of the round (10126:B:1) flips Captain Thaurdir, whose Champion side attacks the first player at once (10128:A:4).
    expect(attacks).toEqual(["10127@0", "10127@1", "10128@0"]);
    // One shadow card at each attack: the card of the first attack was discarded before the second was dealt (faq.additional-attacks).
    expect(shadowsAtAttack).toEqual([1, 1, 1]);
    const thaurdir = run.state.cards[idOf(run.state, CHAMPION)];
    expect(thaurdir?.zone).toBe("staging");
    expect(run.steps.some((step) => step.kind === "engage")).toBe(false);
  });

  it("10126:B:1 resolves the shadow cards Thaurdir already holds with his first attack of the combat phase, and each later attack is dealt and discards a card of its own", () => {
    const held = (state: ScenarioState, t: ReturnType<typeof built>): ScenarioState => {
      const id = idOf(state, CAPTAIN);
      return [1, 2].reduce((next) => runInstruction(next, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: id }, t.ctx, []), state);
    };
    const { attacks, shadowsAtAttack } = playCombat({ seats: 2, staging: [CAPTAIN], deck: ACTIVE_FLAGS }, held);
    expect(attacks).toEqual(["10127@0", "10127@1", "10128@0"]);
    // Two held cards and the one dealt for the attack resolve together; the second attack discarded them first and was dealt one.
    expect(shadowsAtAttack).toEqual([3, 1, 1]);
  });

  it("10126:B:1 makes Thaurdir attack the one player of a solo game once", () => {
    const { attacks, run } = playCombat({ staging: [CHAMPION], deck: ACTIVE_FLAGS });
    expect(attacks).toEqual(["10128@0"]);
    // Champion side faceup: the end of the round does not flip him.
    expect(run.state.cards[idOf(run.state, CHAMPION)]?.code).toBe(CHAMPION);
  });
});

describe("Midwinter's Crux (stage 2B) and the cards that read Thaurdir's side", () => {
  const FURIOUS = "10139";
  it("10126:B:2 keeps Thaurdir indestructible below 15 progress on the stage and lets damage destroy him at 15 or more, 10126:B:3 then wins the game", () => {
    const damageThaurdir = (progress: number): ScenarioState => {
      const t = built({ stage: "10126", progress, staging: [CHAMPION] });
      const hit = placeDamage(t.state, idOf(t.state, CHAMPION), 99, t.cards, [], "framework", ruleCause("rr.damage"));
      return settled(hit, t);
    };
    const below = damageThaurdir(14);
    expect(below.cards[idOf(below, CHAMPION)]?.zone).toBe("staging");
    expect(below.stageCleared).toBeFalsy();
    const at = damageThaurdir(15);
    expect(at.cards[idOf(at, CHAMPION)]?.zone).toBe("encounterDiscard");
    expect(at.stageCleared).toBe(true);
  });

  it("10126:B:2 stops the stage from being defeated while Thaurdir is in play, either side, and not once he is gone", () => {
    const open = (code: string | null) => built({ stage: "10126", progress: 14, staging: code ? [code] : [] });
    const gate = (t: ReturnType<typeof open>) => (current: ScenarioState) => restricted(current, t.ctx, "advance").length === 0;
    for (const code of [CAPTAIN, CHAMPION]) {
      const t = open(code);
      const placed = placeQuestProgress(t.state, 6, t.cards, [], gate(t));
      expect(placed.questStage, code).toBe(t.state.questStage);
      expect(placed.cards[placed.questStage ?? ""]?.progress, code).toBe(20);
    }
    const alone = open(null);
    const advanced = placeQuestProgress(alone.state, 6, alone.cards, [], gate(alone));
    expect(advanced.questStage === alone.state.questStage && advanced.cards[advanced.questStage ?? ""]?.progress === 20).toBe(false);
  });

  it("10139:A:2 gives each character -2 Defense for the round and flips Captain Thaurdir when progress is placed on Furious Charge, once for each placement", () => {
    const t = built({ stage: "10125", staging: [CAPTAIN, FURIOUS] });
    const current = setCurrentQuest(t.state, idOf(t.state, FURIOUS), t.ctx);
    const steps: EngineStep[] = [];
    const placed = settled(placeQuestProgress(current, 2, t.cards, steps, canAdvance), t, steps);
    expect(placed.cards[idOf(placed, FURIOUS)]?.progress).toBe(2);
    expect(placed.cards[idOf(placed, CHAMPION)]?.code).toBe(CHAMPION);
    const hero = placed.cards[t.hero]!;
    expect(modifiedStat(placed, hero, "defense", t.cards)).toBe(Math.max(0, (t.cards.get("dh1")?.defense ?? 0) - 2));
    // Champion side up: a second placement flips nobody.
    const more: EngineStep[] = [];
    const again = settled(placeQuestProgress(placed, 1, t.cards, more, canAdvance), t, more);
    expect(again.cards[idOf(again, CHAMPION)]?.code).toBe(CHAMPION);
  });

  it("10132:A:1 gives the main quest card and the staged side quests the battle keyword while Accursed Battlefield is the active location, a side quest current included", () => {
    const t = built({ active: "10132", staging: [FURIOUS] });
    const quest = t.state.questStage ?? "";
    expect(questStatOf(t.state, t.hero, t.cards)).toBe("attack");
    const current = setCurrentQuest(t.state, idOf(t.state, FURIOUS), t.ctx);
    expect(questStatOf(current, t.hero, t.cards)).toBe("attack");
    expect(flagged(current, idOf(current, FURIOUS), "battle")).toBe(true);
    expect(flagged(current, quest, "battle")).toBe(true);
    const off = built({ staging: [FURIOUS] });
    expect(questStatOf(off.state, off.hero, off.cards)).toBe("willpower");
  });
});

describe("Blight of Carn Dûm and Fortress Walls", () => {
  it("10134:A:1 heals 1 damage from an enemy once its attack is over, while Blight is in the staging area, and nothing without it", () => {
    const damageAfter = (layout: Layout): number => {
      const fight = fightEnemy((made: Layout) => built(made), "f0", "f3", { engaged: [{ code: "f3", seat: 0, damage: 2 }], ...layout });
      return fight.run.state.cards[idOf(fight.run.state, "f3")]?.damage ?? -1;
    };
    expect(damageAfter({ staging: ["10134"] })).toBe(1);
    expect(damageAfter({ active: "10134" })).toBe(1);
    expect(damageAfter({})).toBe(2);
  });

  it("10135:A:1 raises a player's threat by 1 for each resource spent while Fortress Walls is the active location, and not otherwise", () => {
    const threatAfterPlaying = (active: boolean): number => {
      const t = built({ phase: "Planning", hand: ["ally"], heroResources: 3, ...(active ? { active: "10135" } : {}) });
      const before = seatThreat(t.state, 0);
      const cardId = idOf(t.state, "ally");
      const played = send(start(t.state), { type: "PlayCard", cardId, payments: [{ heroId: t.hero, amount: 1 }] }, t.ctx);
      const done = finish(played, t.ctx);
      return seatThreat(done.state, 0) - before;
    };
    expect(threatAfterPlaying(true)).toBe(1);
    expect(threatAfterPlaying(false)).toBe(0);
  });
});

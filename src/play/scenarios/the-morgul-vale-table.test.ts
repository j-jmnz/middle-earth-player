// Rules: ats.captain-enemies, ats.setup-the-morgul-vale, ats.setup-the-morgul-vale-to-the-tower, rr.cannot, rr.destroy, rr.damage, rr.reveal, rr.travel, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06144:A:1, 06144:B:1, 06145:B:1, 06146:B:2, 06146:B:3, 06147:A:1, 06147:A:2, 06147:A:3, 06148:A:1, 06148:A:2, 06151:A:1, 06152:A:1, 06152:A:2, 06153:A:1, 06153:A:2, 06156:A:1.
// What the table says for The Morgul Vale on real scenes: the To the Tower dial and its warnings, the three stages and their Captains, the Captains', the Bodyguard's, To the Tower's and The White Bridge's previews, the attack sheets and readouts (the Bodyguard's damage, the Nazgûl's cut, Murzag's reveal, Lord Alcaron's
// tokens and additional attack, an enemy sent to the next player), the travel readout of The White Bridge, the refusal reasons, the banner and the log, and the words of the new verbs.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { dealAdditionalShadow } from "../../rules/interpret/interpret.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, revealFromTop, send } from "../../../test/harness/scene-kit.ts";
import { CODES, fight, opened, run, table } from "../../../test/scenarios/the-morgul-vale/table.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { cardKeywords } from "../cards/card-keywords.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { previewCards, questTitle } from "../cards/table-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, Sheet, SheetNames } from "../choice/sheet-types.ts";
import { whyNotPlayable } from "../choice/why.ts";
import { valeRefusal } from "../readouts/against-the-shadow/vale.ts";
import { CAPTAIN_REFUSAL } from "../words/scenarios/against-the-shadow/vale.ts";
import { advanceWords } from "../readouts/quest-advance.ts";
import { readoutFor } from "../readouts/readout.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { createTableStore, nextRoundSteps } from "../store/store.ts";
import { instructionWords } from "../words/instruction.ts";
import { inFate } from "../words/scenarios/fate.ts";

const { murzag, alcaron, nazgul, tower, bodyguard, tracker, sorcerer, bridge, betrayal, rider, terror, deadCity, malice, road, vale } = CODES;
const BOROMIR = "05002";
const ARAGORN = "01001";
const FARAMIR_HERO = "06081";
const FARAMIR_ALLY = "01014";
const DENETHOR = "01010";
const FOREST_SNARE = "01069";
const INFIGHTING = "02058";
const DWARVEN_TOMB = "01053";

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: ScenarioState) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const describe_ = (made: Made) => (code: string) => ({ name: nameOf(made)(code), text: "", source: null }) as never;
const detail = (made: Made, state: ScenarioState, code: string) => previewCards(state, made.ctx, idOf(state, code), describe_(made), idName(made, state), [], ledgerLine).cards.find((card) => card.code === code)?.detail;
const stageLine = (made: Made, state: ScenarioState) => questTitle(state, made.ctx, state.questStage ?? "", "Stage", ledgerLine)?.detail ?? "";
const namesOf = (made: Made, state: ScenarioState): SheetNames => ({ card: idName(made, state), line: () => null });
const logNames = (made: Made, state: ScenarioState): LogNames => ({ card: idName(made, state), code: nameOf(made), effectCard: () => null, rule: () => null, line: () => null });
const dials = (made: Made, state: ScenarioState) => scenarioDials(state, made.ctx, nameOf(made));
// The banner and the log of the steps an intent returned, as the table keeps them.
function told(made: Made, before: ScenarioState, after: ScenarioState, steps: readonly never[]) {
  const kept = nextRoundSteps([], before, after, steps, made.ctx);
  return { banner: momentOf(before, after, kept, { card: idName(made, after) })?.lines.map((line) => line.text), log: logLines(kept, logNames(made, after)).map((line) => line.text) };
}
const withTokens = (made: Made, count: number): ScenarioState => run(made, made.state, { verb: "PlaceProgressOnNamed", name: "To the Tower", amount: count });

describe("the To the Tower dial (06147:A:3)", () => {
  const made = table({ staging: [tower, bridge] });

  it("counts the tokens against the 10 that lose the game, warm from 7 and critical at 9, and a tap shows the card", () => {
    const [dial] = dials(made, opened(made).state);
    expect(dial).toMatchObject({ label: "Tower", word: "0/10", value: 0, limit: 10, warms: true, icon: "progress", name: "Progress tokens on To the Tower: 0 of 10. At 10 the players lose the game:", limitWords: "10 progress tokens on To the Tower lose the game" });
    expect(dial?.cardId).toBe(idOf(made.state, tower));
    expect(dial?.warn).toBeUndefined();
    const six = dials(made, withTokens(made, 6))[0];
    const seven = dials(made, withTokens(made, 7))[0];
    const nine = dials(made, withTokens(made, 9))[0];
    expect(six?.warn).toBeUndefined();
    expect(seven?.warn).toEqual({ level: "near", words: "3 more progress tokens on To the Tower lose the game." });
    expect(nine?.warn).toEqual({ level: "critical", words: "One more progress token on To the Tower loses the game." });
    expect(nine?.word).toBe("9/10");
  });

  it("says what places and removes tokens, for both seats, and The White Bridge's X", () => {
    const two = table({ seats: 2, staging: [tower, bridge] });
    expect(dials(two, withTokens(two, 4))[0]?.note).toBe(
      "To the Tower holds 4 of the 10 progress tokens that lose the game for all players. Morgul Tracker, Lord Alcaron's attacks, Morgul Sorcerer, Morgul Vale and several encounter cards place tokens. Morgul Road removes 1. The White Bridge has Threat 4 and quest points 4.",
    );
  });

  it("has no dial in another scenario or before To the Tower lies in the staging area", () => {
    expect(dials(table({ staging: [murzag] }), opened(table({ staging: [murzag] })).state)).toEqual([]);
  });
});

describe("the three stages and their Captains (06144:B:1, 06145:B:1, 06146:B:2, 06146:B:3)", () => {
  it("stage 1 says Murzag must be destroyed, where he is, that progress never advances it, the Bodyguards and the loss, and the first screen says Faramir is removed", () => {
    const made = table({ seats: 2, engaged: [{ code: murzag, seat: 1 }], staging: [tower, bodyguard] });
    const state = opened(made).state;
    expect(stageLine(made, state)).toBe(
      "To advance: destroy Murzag. Murzag is engaged with Player 2, and cannot leave play unless destroyed. Progress on this stage never advances it. 1 Morgul Bodyguard in play takes the damage meant for a Captain. The players lose when To the Tower holds 10 progress tokens: it holds 0 now.",
    );
    expect(advanceWords(state, made.ctx, state.questStage ?? "", "Stage", ledgerLine).detail).toBe(stageLine(made, state));
  });

  it("stage 1 says once, at the opening, that Faramir was removed from the game", () => {
    const made = table({ staging: [tower, murzag], heroes: [FARAMIR_HERO], hand: [FARAMIR_ALLY] }, undefined, [FARAMIR_HERO, FARAMIR_ALLY]);
    const gone = run(made, made.state, { verb: "RemoveAllNamedFromGame", name: "Faramir" });
    expect(stageLine(made, gone)).toBe(
      "To advance: destroy Murzag. Murzag is in the staging area, and cannot leave play unless destroyed. Progress on this stage never advances it. Faramir is removed from the game: no version of him can be used. The players lose when To the Tower holds 10 progress tokens: it holds 0 now.",
    );
    expect(stageLine(made, { ...gone, round: 2 })).not.toContain("Faramir");
  });

  it("stage 2 names Lord Alcaron and stage 3 names the Nazgûl, whose destruction wins", () => {
    const second = table({ stage: betrayal, staging: [tower, alcaron] });
    expect(stageLine(second, opened(second).state)).toBe("To advance: destroy Lord Alcaron. Lord Alcaron is in the staging area, and cannot leave play unless destroyed. Progress on this stage never advances it. The players lose when To the Tower holds 10 progress tokens: it holds 0 now.");
    const third = table({ stage: rider, staging: [tower, nazgul] });
    expect(stageLine(third, opened(third).state)).toBe("To win: destroy Nazgûl of Minas Morgul. Nazgûl of Minas Morgul is in the staging area, and cannot leave play unless destroyed. Progress on this stage never advances it. The players lose when To the Tower holds 10 progress tokens: it holds 0 now.");
  });

  it("each Captain's preview says he cannot leave play unless destroyed, what his destruction does and who takes his damage; before his stage it says when", () => {
    const made = table({ staging: [tower, bodyguard, murzag, alcaron, nazgul] });
    const state = opened(made).state;
    expect(detail(made, state, murzag)).toBe(
      "Captain. He cannot leave play unless destroyed. Destroying him advances the quest. 1 Morgul Bodyguard in play takes the damage meant for him. After he attacks, reveal the top encounter card for the player he attacked. An enemy engages that player and attacks this phase. A location goes to the staging area. A treachery resolves and is discarded.",
    );
    expect(detail(made, state, alcaron)).toBe(
      "Captain of stage 2. Once that stage is current he cannot leave play unless destroyed. Each attack he begins places 1 progress token on To the Tower (0 of 10 now). Each shadow card dealt to him with no shadow effect gives him one more attack after this one.",
    );
    expect(detail(made, state, nazgul)).toBe("Captain of stage 3. Once that stage is current he cannot leave play unless destroyed. Each damage he takes is cut to 1, with no limit for the round. No attachment can be attached to him. Damage a Morgul Bodyguard takes for him is not cut.");
    const last = table({ stage: rider, staging: [tower, nazgul] });
    expect(detail(last, opened(last).state, nazgul)).toBe("Captain. He cannot leave play unless destroyed. Destroying him wins the game. Each damage he takes is cut to 1, with no limit for the round. No attachment can be attached to him.");
  });

  it("a Captain destroyed advances the stage, and the banner says so", () => {
    const made = table({ engaged: [murzag], staging: [tower] });
    const before = opened(made).state;
    const steps: never[] = [];
    const after = run(made, before, { verb: "DamageCard", amount: 9, target: "self" }, { sourceId: idOf(before, murzag), steps });
    expect(told(made, before, after, steps).banner).toEqual(["9 damage on Murzag", "Murzag is defeated", "The quest advances to The Betrayal"]);
  });

  it("a player card that finds no target says why a Captain is not one, and no attachment can take the Nazgûl", () => {
    const made = table({ stage: rider, phase: "Planning", engaged: [nazgul], staging: [tower], hand: [INFIGHTING, FOREST_SNARE], heroes: [{ code: DENETHOR, resources: 3 }] }, undefined, [INFIGHTING, FOREST_SNARE, DENETHOR]);
    const state = opened(made).state;
    const why = (code: string) => whyNotPlayable(state, made.ctx, idOf(state, code), idName(made, state));
    // Infighting leaves no card out of play, so lifting the Captain's flag gives it no target: no sentence.
    expect(valeRefusal(state, made.ctx, idOf(state, INFIGHTING), false)).toBe("");
    expect(valeRefusal(table({ staging: [tower] }).state, made.ctx, idOf(state, INFIGHTING), false)).toBe("");
    // A card with no target for another reason gets no sentence about the Captain: lifting his flag would not give it one.
    const staged = table({ stage: rider, phase: "Planning", engaged: [nazgul], staging: [tower], hand: [DWARVEN_TOMB], heroes: [{ code: DENETHOR, resources: 3 }] }, undefined, [DWARVEN_TOMB, DENETHOR]);
    const none = opened(staged).state;
    expect(whyNotPlayable(none, staged.ctx, idOf(none, DWARVEN_TOMB), idName(staged, none))).not.toContain("Captain");
    expect(valeRefusal(none, staged.ctx, idOf(none, DWARVEN_TOMB), false)).toBe("");
    expect(why(FOREST_SNARE)).toBe("No card can take it now. No attachment can attach to the Nazgûl of Minas Morgul.");
  });
});

describe("the Captain's refusal on a card that would take him out of play (06144:B:1)", () => {
  // No printed hand card of the pool has a lone Captain as its only target with a leaving verb, so the card is a test-only record on Infighting's code: it picks an enemy and discards it.
  const LEAVING: Effect = { id: "test:leave", cardCode: INFIGHTING, lines: ["02058:A:1"], timing: "action", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DiscardPicked" }] };
  const effects = [...EFFECTS.filter((effect) => effect.cardCode !== INFIGHTING), LEAVING];
  const scene = (staging: string[], engaged: string[]) => table({ phase: "Planning", engaged, staging: [tower, ...staging], hand: [INFIGHTING], heroes: [{ code: DENETHOR, resources: 3 }] }, effects, [INFIGHTING, DENETHOR]);

  it("a card whose only target is a Captain and that would discard him gets the sentence; with another enemy to take it the card has a target and no sentence", () => {
    const lone = scene([murzag], []);
    const state = opened(lone).state;
    expect(valeRefusal(state, lone.ctx, idOf(state, INFIGHTING), false)).toBe(CAPTAIN_REFUSAL);
    expect(whyNotPlayable(state, lone.ctx, idOf(state, INFIGHTING), idName(lone, state))).toContain("A Captain cannot leave play unless destroyed");
    const other = scene([murzag, tracker], []);
    const both = opened(other).state;
    // The sentence belongs to a card with no target: with the Tracker to take it, the card has one and no refusal is said.
    expect(whyNotPlayable(both, other.ctx, idOf(both, INFIGHTING), idName(other, both)) ?? "").not.toContain("Captain");
  });
});

describe("the Bodyguard that takes a Captain's damage wears the Shield pill (06148:A:1)", () => {
  it("only the Morgul Bodyguard with the most damage, and only while a Captain is in play", () => {
    const made = table({ phase: "Planning", staging: [tower, bodyguard, bodyguard, murzag] });
    const [first, second] = Object.values(made.state.cards).filter((card) => card.code === bodyguard).map((card) => card.id);
    const hurt = updateCard(made.state, second ?? "", { damage: 2 });
    const mark = (state: ScenarioState, id: string) => slotNumbers(state, made.ctx, id).determined?.word ?? null;
    expect(mark(hurt, second ?? "")).toBe("Shield");
    expect(mark(hurt, first ?? "")).toBeNull();
    expect(mark(hurt, idOf(hurt, murzag))).toBeNull();
    const lone = table({ phase: "Planning", staging: [tower, bodyguard] });
    expect(mark(lone.state, idOf(lone.state, bodyguard))).toBeNull();
  });
});

describe("the Bodyguard, the Nazgûl and the attack sheets (06148:A:1, 06153:A:2)", () => {
  const attackOn = (code: string, staging: string[], heroes: string[] = [BOROMIR]) => {
    const made = table({ phase: "PlayerAttacks", heroes, engaged: [code], staging: [tower, ...staging], ...(code === nazgul ? { stage: rider } : {}) }, undefined, heroes);
    const at = opened(made);
    const sheet = sheetFor(at.state, made.ctx, legalIntents(at.state, made.ctx), namesOf(made, at.state)) as PickSheet;
    const next = (sheet.options[0] as { next?: Sheet } | undefined)?.next;
    return { made, at, next, ids: heroes.map((hero) => idOf(at.state, hero)) };
  };

  it("an attack on a shielded Captain says the damage goes to the Bodyguard and what it holds, in the sheet, the readout and the banner", () => {
    const { made, at, next, ids } = attackOn(murzag, [bodyguard]);
    expect(next?.note).toBe("Damage to Murzag goes to Morgul Bodyguard, which holds 0 of 6 damage. Defense 2. Choose the characters that attack it.");
    expect(readoutFor(at.state, made.ctx, next ?? null, { key: next?.key ?? "", ids, shares: [] }, idName(made, at.state))?.result).toBe("1 damage on Morgul Bodyguard, not Murzag; 5 more destroys it");
    const attacked = send(at, { type: "DeclareAttackers", enemyId: idOf(at.state, murzag), attackerIds: ids }, made.ctx);
    const done = fight(made, attacked, (state) => state.mode !== "playerAttacks");
    const { banner, log } = told(made, at.state, done.state, done.steps as never[]);
    expect(banner).toEqual(["Attack 3 against defense 2", "1 damage on Morgul Bodyguard, in Murzag's place", "Threat +1"]);
    expect(log).toContain("1 damage on Morgul Bodyguard, in Murzag's place");
  });

  it("with no Bodyguard the Captain's damage is told as damage on him, and the Nazgûl says each damage is cut to 1", () => {
    const plain = attackOn(murzag, []);
    expect(plain.next?.note).toBe("Defense 2. Choose the characters that attack it.");
    const { made, at, next, ids } = attackOn(nazgul, [], [BOROMIR, ARAGORN]);
    expect(next?.note).toBe("He takes 1 damage at most from each attack. Defense 4. Choose the characters that attack it.");
    const attacked = send(at, { type: "DeclareAttackers", enemyId: idOf(at.state, nazgul), attackerIds: ids }, made.ctx);
    const done = fight(made, attacked, (state) => state.mode !== "playerAttacks");
    const { banner, log } = told(made, at.state, done.state, done.steps as never[]);
    expect(banner).toEqual(["Attack 6 against defense 4", "1 damage on Nazgûl of Minas Morgul, cut to 1", "Threat +1"]);
    expect(log).toContain("1 damage on Nazgûl of Minas Morgul, cut to 1");
  });

  it("an attack that deals the Nazgûl nothing says no damage once, and no damage of 0 follows", () => {
    const { made, at, ids } = attackOn(nazgul, []);
    const attacked = send(at, { type: "DeclareAttackers", enemyId: idOf(at.state, nazgul), attackerIds: ids.slice(0, 1) }, made.ctx);
    const done = fight(made, attacked, (state) => state.mode !== "playerAttacks");
    const { banner, log } = told(made, at.state, done.state, done.steps as never[]);
    expect(banner).toEqual(["Attack 3 against defense 4", "No damage", "Threat +1"]);
    expect(log.some((text) => text.includes("0 damage"))).toBe(false);
  });

  it("the Bodyguard's own preview says whose damage it takes and how much it holds", () => {
    const made = table({ staging: [tower, { code: bodyguard, damage: 2 }, { code: bodyguard }] });
    expect(detail(made, opened(made).state, bodyguard)).toBe("While it is in play, damage meant for a Captain goes whole to the Morgul Bodyguard with the most damage. The Bodyguard's own Defense does not reduce it. 2 Morgul Bodyguards in play. This one has 2 of 6 damage.");
  });

  it("an enemy that goes back to the staging area by a shadow card, or by Morgul Vale at the end of the round, says so in the banner and the log", () => {
    const made = table({ phase: "Combat", staging: [tower], engaged: [murzag], deck: [road, bodyguard, bodyguard] });
    const id = made.state.seats[0]?.engaged[0] ?? "";
    const first = fight(made, opened(made, dealAdditionalShadow(made.state, id, [], made.ctx)), (state) => state.pendingAttack != null && state.window?.kind === "defense", { heroCode: "dh1" });
    const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, made.ctx);
    const { banner, log } = told(made, first.state, answered.state, answered.steps.slice(first.steps.length) as never[]);
    expect(answered.state.cards[id]?.zone).toBe("staging");
    expect(banner).toContain("Murzag returns to the staging area (Morgul Road's shadow effect)");
    expect(log).toContain("Murzag returns to the staging area (Morgul Road's shadow effect)");
    // The end of the round: the engine's step of the return, with Morgul Vale's Forced effect as its cause, is worded with the card that did it.
    const round = table({ phase: "Refresh", staging: [tower, vale], engaged: [murzag] });
    const before = { ...opened(round).state, phase: "End of round" as const };
    const gone = { ...before, cards: { ...before.cards, [idOf(before, murzag)]: { ...before.cards[idOf(before, murzag)], zone: "staging" as const } } } as ScenarioState;
    expect(told(round, before, gone, [{ kind: "returnToStaging", enemyId: idOf(before, murzag), cause: { effect: "06155:forced:1", line: "06155:A:1" } }] as never[]).log).toContain("Murzag returns to the staging area (Morgul Vale's effect at the end of the round)");
  });

  it("the return names the shadow card whose record returns the attacker, also when it is not the first one, and cites that record's line", () => {
    const made = table({ phase: "Combat", staging: [tower], engaged: [sorcerer], deck: [terror, road, bodyguard, bodyguard] }, undefined, [terror, road]);
    const id = made.state.seats[0]?.engaged[0] ?? "";
    const dealt = dealAdditionalShadow(dealAdditionalShadow(made.state, id, [], made.ctx), id, [], made.ctx);
    expect([dealt.cards[id]?.shadowId, ...(dealt.cards[id]?.extraShadowIds ?? [])].map((card) => dealt.cards[card ?? ""]?.code)).toEqual([terror, road]);
    const first = fight(made, opened(made, dealt), (state) => state.pendingAttack != null && state.window?.kind === "defense", { heroCode: "dh1" });
    const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, made.ctx);
    expect(answered.state.cards[id]?.zone).toBe("staging");
    const kept = nextRoundSteps([], first.state, answered.state, answered.steps.slice(first.steps.length) as never[], made.ctx);
    const back = kept.find((step) => "vale" in step && (step.vale as { returns?: unknown }).returns != null);
    expect(back).toMatchObject({ cause: { effect: "06154:shadow:1", line: "06154:A:2" } });
    expect(told(made, first.state, answered.state, answered.steps.slice(first.steps.length) as never[]).log).toContain("Morgul Sorcerer returns to the staging area (Morgul Road's shadow effect)");
  });

  it("an enemy a Bodyguard's shadow sends to the next player is told in the banner and on the new attack's sheet", () => {
    const made = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [tracker], deck: [bodyguard, sorcerer, sorcerer, sorcerer], heroes: [{ code: BOROMIR, seat: 1 }] }, undefined, [BOROMIR]);
    const id = made.state.seats[0]?.engaged[0] ?? "";
    const dealt = dealAdditionalShadow(made.state, id, [], made.ctx);
    const first = fight(made, opened(made, dealt), (state) => state.pendingAttack?.seat === 0 && state.window?.kind === "defense", { heroCode: "dh1" });
    const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, made.ctx);
    const { banner, log } = told(made, first.state, answered.state, answered.steps.slice(first.steps.length) as never[]);
    expect(banner).toEqual(["A Morgul Bodyguard's shadow effect ends the attack with no damage: Morgul Tracker engages Player 2 and attacks Player 2 now"]);
    expect(log).toContain("A Morgul Bodyguard's shadow effect ends the attack with no damage: Morgul Tracker engages Player 2 and attacks Player 2 now");
    const sheet = sheetFor(answered.state, made.ctx, legalIntents(answered.state, made.ctx), namesOf(made, answered.state)) as PickSheet;
    expect(sheet.note).toBe("Attack 1. A Morgul Bodyguard's shadow effect sent Morgul Tracker to you: the first attack ended with no damage, and this one has a shadow card of its own. Choose a defender, or leave it undefended.");
  });
});

describe("Murzag and Lord Alcaron attack (06151:A:1, 06152:A:1, 06152:A:2)", () => {
  it("Murzag's sheet names the player attacked and what follows; his reveal and the enemy it engages are one line of the banner", () => {
    const made = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [{ code: murzag, seat: 1 }], heroes: [{ code: BOROMIR, seat: 1 }], deck: [tracker, bodyguard] }, undefined, [BOROMIR]);
    const asked = fight(made, opened(made), (state) => state.window?.kind === "defense");
    const sheet = sheetFor(asked.state, made.ctx, legalIntents(asked.state, made.ctx), namesOf(made, asked.state)) as PickSheet;
    expect(sheet.note).toBe("Attack 5. After it, Murzag reveals the top card of the encounter deck for Player 2, the player attacked. Choose a defender, or leave it undefended.");
    const done = fight(made, asked, (state) => state.pendingAttack != null && state.cards[state.pendingAttack.enemyId]?.code === tracker, { heroCode: "dh3" });
    const { banner, log } = told(made, asked.state, done.state, done.steps.slice(asked.steps.length) as never[]);
    expect(banner).toEqual(["Attack 5 on dh3, undefended", "5 damage on dh3", "Murzag reveals Morgul Tracker: it engages Player 2 and attacks this phase", "Staging", "Revealed Morgul Bodyguard"]);
    expect(log).toContain("Murzag reveals Morgul Tracker: it engages Player 2 and attacks this phase");
  });

  it("Lord Alcaron's sheet says the token he placed and the attack a blank shadow card gives; an additional attack says where it comes from", () => {
    const made = table({ seats: 1, phase: "Combat", stage: betrayal, staging: [tower], engaged: [alcaron], heroes: [BOROMIR, ARAGORN], deck: ["f0", bodyguard, bodyguard, bodyguard, bodyguard] }, undefined, [BOROMIR, ARAGORN]);
    const dealt = dealAdditionalShadow(made.state, idOf(made.state, alcaron), [], made.ctx);
    const first = fight(made, opened(made, dealt), (state) => state.window?.kind === "defense");
    const sheet = (state: ScenarioState) => (sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state)) as PickSheet).note;
    expect(sheet(first.state)).toBe("Attack 4. He placed 1 progress token on To the Tower (1 of 10). A shadow card with no effect gives him another attack. Choose a defender, or leave it undefended.");
    const next = fight(made, send(first, { type: "Undefended", heroId: idOf(first.state, BOROMIR) }, made.ctx), (state) => state.window?.kind === "defense" && state.pendingAttack?.immediate === true);
    expect(sheet(next.state)).toBe(
      "Attack 4. Lord Alcaron's additional attack: his shadow card had no effect. It has a shadow card of its own. He placed 1 progress token on To the Tower (2 of 10). A shadow card with no effect gives him another attack. Choose a defender, or leave it undefended.",
    );
  });

  it("a token Lord Alcaron places is told with the count it reaches and the card that placed it", () => {
    const made = table({ seats: 1, phase: "Combat", stage: betrayal, staging: [tower], engaged: [alcaron], heroes: [BOROMIR, ARAGORN], deck: [bodyguard, bodyguard] }, undefined, [BOROMIR, ARAGORN]);
    const before = opened(made).state;
    const asked = fight(made, opened(made), (state) => state.window?.kind === "defense");
    const { banner, log } = told(made, before, asked.state, asked.steps as never[]);
    expect(banner?.some((text) => text.startsWith("1 progress on To the Tower, 1 of 10 (Lord Alcaron)"))).toBe(true);
    expect(log).toContain("1 progress on To the Tower, 1 of 10");
  });
});

describe("tokens placed and removed on To the Tower (06147:A:3)", () => {
  const made = table({ staging: [tower] });

  it("the banner and the log say the placement and the count of 10", () => {
    const before = opened(made).state;
    const steps: never[] = [];
    const after = run(made, before, { verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 3 }, { steps });
    expect(told(made, before, after, steps)).toEqual({ banner: ["3 progress on To the Tower, 3 of 10"], log: ["3 progress on To the Tower, 3 of 10"] });
    const more: never[] = [];
    const nine = run(made, withTokens(made, 9), { verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 1 }, { steps: more });
    expect(told(made, withTokens(made, 9), nine, more).banner).toEqual(["1 progress on To the Tower, 10 of 10: the players lose the game"]);
  });

  it("a token a player chooses to place names the player and is told once", () => {
    const two = table({ seats: 2, staging: [tower, murzag], deck: [malice, bodyguard, bodyguard] }, undefined, [malice]);
    const revealed = revealFromTop(two.state, two.ctx, malice, []);
    const first = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "discard" }, two.ctx);
    const second = send(first, { type: "Choose", optionId: "token" }, two.ctx);
    const { banner, log } = told(two, first.state, second.state, second.steps.slice(first.steps.length) as never[]);
    expect(banner).toEqual(["Player 2 places 1 progress on To the Tower, 1 of 10 (Sleepless Malice)"]);
    expect(log).toContain("Player 2 places 1 progress on To the Tower, 1 of 10");
    // Morgul Road removes progress by title like The Fate of Wilderland's records, but that scenario's beats ("holds 2 progress") are not this one's.
    expect(inFate(second.state, two.ctx)).toBe(false);
  });

  it("only the placement of the record the choice window belongs to names the player, not another card's token in the same intent", () => {
    const two = table({ seats: 2, staging: [tower, murzag], deck: [malice, bodyguard, bodyguard] }, undefined, [malice]);
    const revealed = revealFromTop(two.state, two.ctx, malice, []);
    const first = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "discard" }, two.ctx);
    const second = send(first, { type: "Choose", optionId: "token" }, two.ctx);
    const own = second.steps.slice(first.steps.length).find((step) => step.kind === "progress");
    expect(own).toBeDefined();
    // The same intent goes on to a Terror Drives Them revealed after it: its token is the second placement.
    const terrorToken = { ...own, cause: { effect: "06159:whenRevealed:1", line: "06159:A:2" } };
    const { log } = told(two, first.state, second.state, [own, terrorToken] as never[]);
    expect(log).toEqual(["Player 2 places 1 progress on To the Tower, 1 of 10", "1 progress on To the Tower, 2 of 10"]);
  });

  it("the choice notes of Sleepless Malice and the Sorcerer's shadow tell of the shadow cards only while a Morgul Sorcerer is in play", () => {
    const note = (made: Made, state: ScenarioState) => (sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(made, state)) as { note?: string } | null)?.note ?? "";
    const SAYS = "is dealt a shadow card";
    const malicePlain = table({ staging: [tower, murzag], deck: [malice, bodyguard, bodyguard] }, undefined, [malice]);
    const malicePlace = table({ staging: [tower, murzag, sorcerer], deck: [malice, bodyguard, bodyguard] }, undefined, [malice]);
    const asked = (made: Made) => revealFromTop(made.state, made.ctx, malice, []).state;
    expect(note(malicePlain, asked(malicePlain))).toContain("Sleepless Malice: discard 3 cards");
    expect(note(malicePlain, asked(malicePlain))).not.toContain(SAYS);
    expect(note(malicePlace, asked(malicePlace))).toContain(SAYS);
    // The Sorcerer's own shadow card, dealt to a Tracker: the note says so only when a Sorcerer stands in play too.
    const shadowAsk = (staging: string[]) => {
      const made = table({ phase: "Combat", staging: [tower, ...staging], engaged: [tracker], deck: [sorcerer, bodyguard, bodyguard] }, undefined, [sorcerer]);
      const id = made.state.seats[0]?.engaged[0] ?? "";
      const at = fight(made, opened(made, dealAdditionalShadow(made.state, id, [], made.ctx)), (state) => state.window?.kind === "choose", { defender: "dh1", heroCode: "dh1" });
      return note(made, at.state);
    };
    expect(shadowAsk([])).toContain("Morgul Sorcerer, shadow effect");
    expect(shadowAsk([])).not.toContain(SAYS);
    expect(shadowAsk([sorcerer])).toContain("is dealt a shadow card after tokens are placed");
  });

  it("the store hands the banner the stamped steps, so the banner words them as the log does", () => {
    const two = table({ seats: 2, staging: [tower, murzag], deck: [malice, bodyguard, bodyguard] }, undefined, [malice]);
    const revealed = revealFromTop(two.state, two.ctx, malice, []);
    const first = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "discard" }, two.ctx);
    const store = createTableStore({ ctx: two.ctx, game: first.state });
    expect(store.getState().dispatch({ type: "Choose", optionId: "token" })).toBe(true);
    const moment = store.getState().moment;
    expect(moment?.kind).toBe("sent");
    if (moment?.kind !== "sent") return;
    expect(momentOf(moment.before, moment.after, moment.steps, { card: idName(two, moment.after) })?.lines.map((line) => line.text)).toEqual(["Player 2 places 1 progress on To the Tower, 1 of 10 (Sleepless Malice)"]);
  });

  it("a removal says what was taken and the count left", () => {
    const seven = withTokens(made, 7);
    const steps: never[] = [];
    const after = run(made, seven, { verb: "RemoveProgressFrom", amount: 1, named: "To the Tower" }, { steps });
    expect(told(made, seven, after, steps).banner).toEqual(["1 progress removed from To the Tower, 6 of 10"]);
  });
});

describe("The White Bridge's X (06156:A:1)", () => {
  it("its preview says X and its Threat and quest points now, and what no token does", () => {
    const made = table({ staging: [tower, bridge] });
    expect(detail(made, opened(made).state, bridge)).toBe("Threat X and quest points X: X is the progress tokens on To the Tower, 0 now. Its Threat is 0 and its quest points are 0. As the active location it would take no progress.");
    expect(detail(made, withTokens(made, 3), bridge)).toBe("Threat X and quest points X: X is the progress tokens on To the Tower, 3 now. Its Threat is 3 and its quest points are 3.");
    const active = table({ staging: [tower], active: bridge });
    expect(detail(active, opened(active).state, bridge)).toBe(
      "Threat X and quest points X: X is the progress tokens on To the Tower, 0 now. Its Threat is 0 and its quest points are 0. It takes no progress, and stays the active location until a token is placed on To the Tower.",
    );
  });

  it("the travel readout says the quest points it has once active, X included", () => {
    const made = table({ phase: "Travel", staging: [tower, bridge] });
    const at = opened(made, withTokens(made, 3));
    const sheet = sheetFor(at.state, made.ctx, legalIntents(at.state, made.ctx), namesOf(made, at.state)) as PickSheet;
    const travel = (state: ScenarioState) => readoutFor(state, made.ctx, sheet, { key: sheet.key, ids: [idOf(state, bridge)], shares: [] }, idName(made, state))?.result;
    expect(travel(at.state)).toBe("It takes the next 3 progress before the quest (X = 3 tokens on To the Tower)");
    expect(travel(opened(made).state)).toBe("It has 0 quest points (X = 0 on To the Tower): it takes no progress and stays active until a token is placed");
  });
});

describe("To the Tower and the chips of the scenario", () => {
  it("To the Tower's preview says it stays, what counts it and the tokens against the 10", () => {
    const made = table({ staging: [tower] });
    expect(detail(made, withTokens(made, 4), tower)).toBe(
      "Objective. It stays in the staging area all game: no card or effect can shuffle, discard or take it, and it is never engaged. The Power of Mordor counts it. It holds 4 of the 10 progress tokens that lose the game. Card effects place progress tokens on it; questing never does.",
    );
  });

  it("Doomed 2 and Surge show as the chips the cards print, and the card that only gains Surge shows none", () => {
    const made = table({ staging: [tower, terror, deadCity, malice, tracker] });
    const state = opened(made).state;
    const chips = (code: string) => cardKeywords(state, made.ctx, idOf(state, code)).map((chip) => chip.word);
    expect(chips(terror)).toEqual(["Surge"]);
    expect(chips(deadCity)).toEqual([]);
    expect(chips(malice)).toEqual(["Doomed 2"]);
    expect(chips(tracker)).toEqual(["Surge"]);
  });
});

describe("the words of the new verbs", () => {
  const made = table({ staging: [tower] });
  const words = (instruction: Parameters<typeof instructionWords>[0]) => instructionWords(instruction, made.state, { card: () => "", code: () => "" } as never, null);

  it("each verb says what it does in a choice or a response", () => {
    expect(words({ verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 3 })).toBe("place 3 progress tokens on To the Tower");
    expect(words({ verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 1 })).toBe("place 1 progress token on To the Tower");
    expect(words({ verb: "RemoveAllNamedFromGame", name: "Faramir" })).toBe("remove every Faramir the players own from the game, whether in a deck, a hand, a discard pile or in play");
    expect(words({ verb: "RevealTopEngaging" })).toBe("reveal the top card of the encounter deck in full for the player attacked: an enemy engages that player and attacks this phase");
    expect(words({ verb: "AttackPerBlankShadow" })).toBe("make one more attack for each shadow card dealt with no shadow effect");
  });
});

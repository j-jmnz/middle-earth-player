// Rules: rr.attachment-cards, rr.treachery-cards, rr.lasting-effects, rr.modifiers, faq.lasting-effects (data/rules/entries.json); ledger lines 21017:A:1, 21021:A:1, 21021:A:2, 21024:A:2, 21025:A:1, 21027:A:2.
// The mordor family's verbs on a table of The River Running: AttachTreachery (a treachery of the encounter discard pile attached to an enemy) and ModifyHeld (a lasting effect read live by a class of cards).
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { updateCard } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { idOf, opened, revealedTop, run, statOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const HORSE = "21019";
const SWORD = "21022";
const WARRIOR = "21021";
const RAIDER = "21020";
const PLAINS = "21025";
const OUTCROP = "21026";
const WEARY = "21027";
const table = (layout: Layout = {}) => tableFromLayout("the-river-running", { seats: 1, stage: "21075", phase: "Quest", ...layout });
const attached = (state: ScenarioState, code: string): string[] => (state.cards[idOf(state, code)]?.attachments ?? []).map((id) => state.cards[id]?.code ?? "");
const attach = (made: ReturnType<typeof table>, instruction: Instruction, sourceCode: string | null = WARRIOR) => run(made, opened(made).state, instruction, { sourceId: sourceCode ? idOf(made.state, sourceCode) : null });

describe("AttachTreachery: the top Easterling treachery of the discard pile lies attached to the enemy, none resolved", () => {
  it("takes the topmost treachery with the Trait, not an earlier one and not a card of another type, and leaves the rest of the pile", () => {
    const made = table({ staging: [WARRIOR], discard: [SWORD, "21013", HORSE, "21016"] });
    const state = attach(made, { verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" });
    expect(attached(state, WARRIOR)).toEqual([HORSE]);
    expect(state.cards[idOf(state, HORSE)]).toMatchObject({ zone: "attached", face: "up" });
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toEqual([SWORD, "21013", "21016"]);
  });

  it("attaches nothing when the pile holds no Easterling treachery", () => {
    const made = table({ staging: [WARRIOR], discard: ["21013", "21016"] });
    expect(attached(attach(made, { verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" }), WARRIOR)).toEqual([]);
  });

  it("attaches to the attacking enemy or the event's subject, whichever `to` names", () => {
    const made = table({ staging: [WARRIOR, RAIDER], discard: [HORSE] });
    const state = opened(made).state;
    const withAttack = { ...state, pendingAttack: { enemyId: idOf(state, RAIDER), defenderId: null, undefended: true } } as unknown as ScenarioState;
    const attacked = run(made, withAttack, { verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "attacker" }, { sourceId: idOf(state, WARRIOR) });
    expect(attached(attacked, RAIDER)).toEqual([HORSE]);
    expect(attached(attacked, WARRIOR)).toEqual([]);
  });

  it("`picked` attaches the card DiscardUntil found: the Captain entering play discards down to an Easterling treachery and takes it; with none nothing attaches", () => {
    const made = table({ deck: ["21016", "21013", HORSE, SWORD] });
    const state = revealedTop(made, "21017");
    expect(attached(state, "21017")).toEqual([HORSE]);
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toEqual(["21016", "21013"]);
    const none = revealedTop(table({ deck: ["21016", "21013"], discard: [SWORD] }), "21017");
    expect(attached(none, "21017")).toEqual([]);
    // The whole deck was discarded for nothing; the deck is refilled from the pile (rr.running-out-of-cards), so the cards are all in one of the two piles.
    expect([...none.encounterDeck, ...none.encounterDiscard].map((id) => none.cards[id]?.code).sort()).toEqual([SWORD, "21013", "21016"].sort());
  });

  it("a host that is not in play takes nothing", () => {
    const made = table({ staging: [], hand: [], discard: [HORSE], setAside: [WARRIOR] });
    expect(attached(attach(made, { verb: "AttachTreachery", from: "discardTop", trait: "Easterling", to: "self" }), WARRIOR)).toEqual([]);
  });
});

describe("ModifyHeld: a lasting effect held by a class, read as the table stands", () => {
  it("-1 Willpower to each exhausted character: a character exhausted later holds it, one that readies loses it", () => {
    const made = table({ phase: "Quest", staging: [WEARY] });
    const state = opened(made).state;
    const hero = (code: string): string => idOf(state, code);
    const held = run(made, state, { verb: "ModifyHeld", stat: "willpower", amount: -1, holders: "exhaustedCharacters", until: "endOfPhase" }, { sourceId: idOf(state, WEARY) });
    const willpower = (s: ScenarioState, id: string): number => modifiedStat(s, s.cards[id]!, "willpower", made.ctx.cards);
    const dh1 = hero("dh1");
    const before = willpower(held, dh1);
    expect(willpower(updateCard(held, dh1, { exhausted: true }), dh1)).toBe(Math.max(0, before - 1));
    expect(willpower(updateCard(updateCard(held, dh1, { exhausted: true }), dh1, { exhausted: false }), dh1)).toBe(before);
  });

  it("+2 Threat to each card with the source's title: a copy that enters play later in the phase holds it, other titles do not", () => {
    const made = table({ staging: [PLAINS, OUTCROP] });
    const state = opened(made).state;
    const held = run(made, state, { verb: "ModifyHeld", stat: "threat", amount: 2, holders: "sourceTitle", until: "endOfPhase" }, { sourceId: idOf(state, PLAINS) });
    expect(statOf(held, made.ctx.cards, PLAINS, "threat")).toBe(statOf(state, made.ctx.cards, PLAINS, "threat") + 2);
    expect(statOf(held, made.ctx.cards, OUTCROP, "threat")).toBe(statOf(state, made.ctx.cards, OUTCROP, "threat"));
  });
});

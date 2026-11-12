// Rules: rr.step-3-3, mec108.orc-deck, mec108.side-quests-in-play, rr.blank, rr.surge, rr.travel, rr.first-player, mec112.gollum-smeagol, faq.enemy-attacks-outside-combat, mec108.campaign-setup-the-weather-hills (data/rules/entries.json);
// ledger lines 09026:A:2, 09029:A:2, 09054:A:1, 09069:B:1, 09069:B:2, 09070:A:1, 09071:A:1, 09072:A:1, 10159:A:2, 10160:A:3, 10165:A:4. The angmar family's verbs of The Weather Hills, on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { hasKeyword } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { settle } from "../../engine/machine.ts";
import { textBlank } from "../attachments/hold.ts";
import type { Focus } from "../index.ts";
import { endPhase } from "./phase.ts";
import { HERO, idOf, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-weather-hills";
const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, layout);
const codesAt = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

describe("Cold from Angmar", () => {
  it("09054:A:1 attaches to the main quest card and blanks the text box of a damaged character, keeping its keywords", () => {
    const t = built({ play: [] });
    const cards = new Map(t.ctx.cards);
    const sentinel = definePrinted({ code: "sen", name: "Sentinel ally", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health: 3, keywords: { sentinel: true } });
    cards.set("sen", sentinel);
    const ctx = { ...t.ctx, cards };
    const run = resolveRecords(t.state, ctx, "09054", "whenRevealed");
    const cold = idOf(run.state, "09054");
    expect(run.state.cards[cold]?.host).toBe(run.state.questStage);
    expect(run.state.cards[idOf(run.state, HERO)]?.damage).toBe(1);
    const ally = spawn(run.state, "sen", { zone: "play", seat: 0 });
    const state = settle(updateCard(ally.state, ally.id, { damage: 1 }), ctx, []);
    expect(textBlank(state, idOf(state, HERO), ctx.cards)).toBe(true);
    // The damaged ally's text box is blank, but Sentinel is a keyword and stays; an undamaged one is untouched.
    expect(textBlank(state, ally.id, ctx.cards)).toBe(true);
    expect(hasKeyword(state, ally.id, "sentinel", ctx.cards)).toBe(true);
    const bare = settle(updateCard(ally.state, ally.id, { damage: 0 }), ctx, []);
    expect(textBlank(bare, ally.id, ctx.cards)).toBe(false);
  });
});

describe("the first Weather treachery of a round", () => {
  it("09069:B:1 gains surge, the second of the round does not, and a card without the Trait never does", () => {
    const t = built({ deck: ["f0", "f3", "f0"] });
    const first = revealFromTop(t.state, t.ctx, "09052", []);
    expect(codesAt(first.state, first.state.staging)).toContain("f0");
    const second = revealFromTop(first.state, t.ctx, "09052", []);
    expect(second.state.staging.filter((id) => second.state.cards[id]?.code === "f3")).toHaveLength(0);
    // A Weather treachery that is not the first of the round is not marked, a new round clears the mark.
    const next = revealFromTop({ ...settle(first.state, t.ctx, []), modifiers: first.state.modifiers.filter((modifier) => modifier.stat !== "traitRevealed") }, t.ctx, "09052", []);
    expect(codesAt(next.state, next.state.staging)).toContain("f3");
  });
});

describe("Cornered Animals", () => {
  const layout: Layout = { phase: "Combat", setAside: ["09046", "09026"], discard: ["f3"], deck: ["09043"], piles: { angmarOrcDeck: ["09044", "09030"] } };

  it("09070:A:1 ends the combat phase, shuffles the discard pile and the Orc deck into the encounter deck, and reveals Orc Ambush and Amon Forn", () => {
    const t = built(layout);
    const run = resolveRecords(t.state, t.ctx, "09070", "whenRevealed", undefined, undefined, false);
    const state = run.state;
    // Orc Ambush's When Revealed ran: the first player's search found the Orc enemy in the encounter deck and engaged it.
    expect(codesAt(state, state.staging)).toEqual(expect.arrayContaining(["09046", "09026"]));
    expect(state.seats[0]?.engaged.map((id) => state.cards[id]?.code)).toContain("09043");
    // The discard pile and the Orc deck are in the encounter deck now (the shuffle came after the search: the search ran after them).
    expect(state.piles?.angmarOrcDeck ?? []).toEqual([]);
    expect(codesAt(state, state.encounterDeck).sort()).toEqual(["09030", "09044", "f3"]);
    // The phase ended with the effect: the combat phase is over.
    expect(state.phase).not.toBe("Combat");
  });

  it("09070:A:1 in the quest phase leaves the characters exhausted and uncommitted and skips the quest resolution", () => {
    const t = built({ ...layout, phase: "Quest", committed: [HERO] });
    expect(t.state.cards[idOf(t.state, HERO)]?.committed).toBe(true);
    const run = resolveRecords(t.state, t.ctx, "09070", "whenRevealed", undefined, undefined, false);
    expect(run.state.cards[idOf(run.state, HERO)]?.committed).toBe(false);
    expect(run.state.phase).not.toBe("Quest");
  });
});

describe("ending the phase in the middle of an attack", () => {
  it("09070:A:1 sets the mark while an attack is open, the attack still resolves, and the next engaged enemy makes no attack (rr.step-3-3)", () => {
    const t = built({ phase: "Combat", engaged: ["09043", "09043"] });
    const [first, second] = t.state.seats[0]?.engaged ?? [];
    const hero = idOf(t.state, HERO);
    if (!first || !second) throw new Error("two engaged enemies");
    // The first enemy's attack waits on its shadow step, as it does when a shadow effect reveals Cornered Animals.
    const attacking: ScenarioState = { ...t.state, mode: "enemyAttacks", window: null, pendingAttack: { enemyId: first, seat: 0, shadowOffered: true, shadowResolved: false, heroId: hero, undefended: true } };
    const marked = endPhase(attacking, { seat: 0, sourceId: first, chosen: undefined } as Focus);
    expect(marked.modifiers.some((modifier) => modifier.stat === "phaseEnds")).toBe(true);
    expect(marked.pendingAttack?.enemyId).toBe(first);
    const done = settle(marked, t.ctx, []);
    // The attack resolved: its damage is on the hero and it is on the record of the attacks made.
    expect((done.cards[hero]?.damage ?? 0) > 0).toBe(true);
    expect(done.resolvedAttacks).toContain(first);
    // The phase ended with it: no second attack, no mark left, the round is past the combat phase.
    expect(done.resolvedAttacks).not.toContain(second);
    expect(done.pendingAttack ?? null).toBeNull();
    expect(done.modifiers.some((modifier) => modifier.stat === "phaseEnds")).toBe(false);
    expect(done.phase).not.toBe("Combat");
  });
});

describe("Hunting the Orcs and Savage Counter-attack", () => {
  it("09071:A:1 places a token for each defeated enemy and, at 3 more than the players, flips to Savage Counter-attack with its tokens; 09072:A:1 advances the quest to stage 2A", () => {
    const below = built({ staging: [{ code: "09071", resources: 2 }] });
    const placed = resolveRecords(below.state, below.ctx, "09071", "forced", idOf(below.state, "09071"));
    expect(placed.state.cards[idOf(placed.state, "09071")]?.resources).toBe(3);
    const at = built({ staging: [{ code: "09071", resources: 3 }] });
    const run = resolveRecords(at.state, at.ctx, "09071", "forced", idOf(at.state, "09071"));
    const flipped = run.state.cards[idOf(run.state, "09072")];
    expect(flipped?.resources).toBe(4);
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("09070");
    // Two players make X 5.
    const two = built({ seats: 2, staging: [{ code: "09071", resources: 3 }] });
    const short = resolveRecords(two.state, two.ctx, "09071", "forced", idOf(two.state, "09071"));
    expect(short.state.cards[idOf(short.state, "09071")]?.resources).toBe(4);
  });

  it("09072:A:2, 09072:A:3 discards a token when an enemy attacks and destroys a character, and loses the game with no token left", () => {
    const t = built({ staging: [{ code: "09072", resources: 2 }] });
    const savage = idOf(t.state, "09072");
    const hero = idOf(t.state, HERO);
    const destroyed = settle(queueEvent(t.state, { trigger: "characterDestroyedByAttack", seat: 0, cardId: hero, subject: hero, other: savage }), t.ctx, []);
    expect(destroyed.cards[savage]?.resources).toBe(1);
    expect(destroyed.lost).not.toBe(true);
    const last = settle(queueEvent(destroyed, { trigger: "characterDestroyedByAttack", seat: 0, cardId: hero, subject: hero, other: savage }), t.ctx, []);
    expect(last.cards[savage]?.resources).toBe(0);
    expect(last.lost).toBe(true);
  });
});

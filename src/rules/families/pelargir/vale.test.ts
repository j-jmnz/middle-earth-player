// Rules: ats.setup-the-morgul-vale-to-the-tower, rr.removed-from-game, rr.in-play-and-out-of-play, rr.reveal, rr.engaged, rr.surge, faq.reveal-and-add (data/rules/entries.json); ledger lines 06144:A:1, 06147:A:2, 06149:A:1, 06149:A:2, 06151:A:1, 06152:A:1
// The engine facts of the three verbs The Morgul Vale adds to the pelargir family, each on the table of the scenario with its own records: progress tokens placed on To the Tower by title, every Faramir removed from the game at Setup, and the card Murzag reveals put into play engaged with the defending player.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { shadowCards } from "../../core/zones.ts";
import { idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";
import { CODES, engagedCodes, fight, opened, run, table, tokens, where } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { rearguard, tower, bodyguard, sorcerer, tracker, murzag, deadCity, fog, vale } = CODES;
const TOWER_NAME = "To the Tower";
const FARAMIRS = { hero: "06081", otherHero: "144002", ally: "01014", otherAlly: "21005" } as const;

describe("PlaceProgressOnNamed", () => {
  it("places the tokens on To the Tower where it lies in the staging area, as one placement the log names", () => {
    const t = table({ staging: [tower] });
    const steps: EngineStep[] = [];
    const placed = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 3 }, { steps });
    expect(tokens(placed)).toBe(3);
    expect(steps.filter((step) => step.kind === "progress")).toEqual([expect.objectContaining({ targetId: idOf(placed, tower), amount: 3 })]);
  });

  it("places nothing, and asks nobody, when no card with the title is in play", () => {
    const t = table({ staging: [murzag] });
    const steps: EngineStep[] = [];
    const placed = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 1 }, { steps });
    expect(steps.filter((step) => step.kind === "progress")).toEqual([]);
    expect(placed.window).toEqual(t.state.window);
  });

  it("is heard once for the three tokens of one placement: a Morgul Sorcerer in the staging area is dealt one shadow card, and one more for the next placement (06149:A:1)", () => {
    const t = table({ staging: [tower, sorcerer], deck: [tracker, tracker, tracker] });
    const one = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 3 });
    expect(shadowCards(one.cards[idOf(one, sorcerer)])).toHaveLength(1);
    const two = run(t, one, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 1 });
    expect(shadowCards(two.cards[idOf(two, sorcerer)])).toHaveLength(2);
    expect(tokens(two)).toBe(4);
  });

  it("is read from the game's own cards: the count a card reads (`ofNamed`) follows the tokens at once (The Dead City Looms raises threat by them, 06160:A:1)", () => {
    const t = table({ staging: [tower], threat: [30, 30] });
    const placed = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 2 });
    const raised = run(t, placed, { verb: "RaiseThreat", amount: { stat: "progress", ofNamed: TOWER_NAME }, who: "eachSeat" });
    expect(raised.seats[0]?.threat).toBe(32);
  });
});

describe("RemoveAllNamedFromGame", () => {
  const layout = {
    seats: 2 as const,
    staging: [tower],
    heroes: [{ code: FARAMIRS.hero, seat: 0 }],
    play: [{ code: FARAMIRS.ally, seat: 1 }],
    hand: [{ code: FARAMIRS.otherAlly, seat: 0 }],
    deckOf: [{ code: FARAMIRS.otherHero, seat: 1 }],
  };
  const extra = Object.values(FARAMIRS);

  it("removes every Faramir the players own, in play, in a hand and in a deck, with no leaving of play announced", () => {
    const t = table(layout, undefined, extra);
    const steps: EngineStep[] = [];
    const removed = run(t, t.state, { verb: "RemoveAllNamedFromGame", name: "Faramir" }, { steps });
    for (const code of extra) expect(where(removed, code)).toBe("removed");
    expect((removed.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay")).toEqual([]);
    // The other heroes of the seat stay.
    expect(where(removed, "dh1")).toBe("heroes");
  });

  it("leaves a card of another title, and the encounter card Faramir that is no player card, where it lies", () => {
    const t = table({ ...layout, hand: [{ code: FARAMIRS.otherAlly, seat: 0 }, { code: "ally", seat: 0 }] }, undefined, extra);
    const removed = run(t, t.state, { verb: "RemoveAllNamedFromGame", name: "Faramir" });
    expect(where(removed, "ally")).toBe("hand");
  });

  it("is run by To the Tower's own Forced effect when the Setup announces it added to the staging area (06147:A:2)", () => {
    const t = table(layout, undefined, extra);
    const source = idOf(t.state, rearguard);
    const done = resolveRecords(t.state, t.ctx, rearguard, "setup", source);
    for (const code of extra) expect(where(done.state, code)).toBe("removed");
    expect(where(done.state, tower)).toBe("staging");
  });
});

describe("RevealTopEngaging", () => {
  // Murzag is engaged with the second player; the top of the encounter deck is a Morgul Tracker; the attack is left undefended.
  const attacked = (deck: readonly string[], layout: Parameters<typeof table>[0] = {}, extra?: readonly string[]) => {
    const t = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [{ code: murzag, seat: 1 }], deck, ...layout }, undefined, extra);
    return { t, start: opened(t) };
  };
  const untilEnemyEngaged = (code: string) => (state: { seats: readonly { engaged: readonly string[] }[]; cards: Record<string, { code: string } | undefined> }) => state.seats.some((seat) => seat.engaged.some((id) => state.cards[id]?.code === code));

  it("puts an enemy into play engaged with the defending player, not staged, and it attacks in the same phase with no shadow card", () => {
    const { t, start } = attacked([tracker, bodyguard]);
    // The attack of the enemy just revealed is the next one the combat phase makes: stop as it is declared.
    const after = fight(t, start, (state) => state.pendingAttack != null && state.cards[state.pendingAttack.enemyId]?.code === tracker, { heroCode: "dh3" });
    expect(after.state.pendingAttack).toMatchObject({ seat: 1 });
    expect(after.state.cards[idOf(after.state, tracker)]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(after.state.staging.map((id) => after.state.cards[id]?.code)).not.toContain(tracker);
    expect(after.state.cards[idOf(after.state, tracker)]?.shadowId).toBeNull();
  });

  it("is a reveal in full: a treachery is resolved and discarded, a location goes to the staging area", () => {
    const fogged = attacked([fog, vale]);
    const afterFog = fight(fogged.t, fogged.start, (state) => state.encounterDiscard.some((id) => state.cards[id]?.code === fog), { heroCode: "dh3", choose: () => "tokens" });
    expect(where(afterFog.state, fog)).toBe("encounterDiscard");
    expect(tokens(afterFog.state)).toBe(3);
    const located = attacked([vale, bodyguard]);
    const afterVale = fight(located.t, located.start, (state) => state.staging.some((id) => state.cards[id]?.code === vale), { heroCode: "dh3" });
    expect(where(afterVale.state, vale)).toBe("staging");
  });

  it("resolves the surge of the card it reveals, and the card that surge reveals is staged as any other (a Dead City Looms with no token gains surge, 06160:A:1)", () => {
    const { t, start } = attacked([deadCity, tracker, bodyguard]);
    const after = fight(t, start, (state) => state.staging.some((id) => state.cards[id]?.code === tracker), { heroCode: "dh3" });
    expect(where(after.state, deadCity)).toBe("encounterDiscard");
    expect(where(after.state, tracker)).toBe("staging");
    expect(engagedCodes(after.state, 1)).toEqual([murzag]);
  });

  it("reveals nothing from an empty deck in the combat phase, and leaves the discard pile where it is: the deck is reset in the quest phase only (rr.running-out-of-cards)", () => {
    const empty = attacked([], { discard: [tracker, tracker] });
    const after = fight(empty.t, empty.start, (state) => state.phase !== "Combat", { heroCode: "dh3" });
    expect(engagedCodes(after.state, 1)).toEqual([murzag]);
    expect(after.state.encounterDiscard).toHaveLength(2);
  });

  it("engages the player attacked, also when the character of another player defended the attack (a Sentinel, 06151:A:1)", () => {
    const { t, start } = attacked([tracker, bodyguard], { play: [{ code: "01029", seat: 0 }] }, ["01029"]);
    const after = fight(t, start, (state) => state.phase !== "Combat" || untilEnemyEngaged(tracker)(state), { defender: "01029" });
    expect(engagedCodes(after.state, 1)).toContain(tracker);
    expect(engagedCodes(after.state, 0)).toEqual([]);
  });
});

// Rules: ats.setup-the-druadan-forest, ats.prowl, hon.siege, hon.archery, rr.travel, rr.discard-pile-and-victory-display, faq.progress-without-advancing (data/rules/entries.json). The engine facts of the verb, the pick filter and the amount The Drúadan Forest adds in the pelargir family that no printed line shows by itself: the game that ends in the window of the attack that fills Drû-buri-Drû, a hero with no resources, the archery of the highest Wose. The printed lines are tested in src/campaign/scenarios/the-druadan-forest/.
import { describe, expect, it } from "vitest";

import { resolveAmount } from "../../interpret/amounts.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { finish, idOf, send, start as begin, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../../test/scenarios/the-druadan-forest/table.ts";

const { passageOut: STAGE_3, druBuriDru: DRU, elite: ELITE, hunter: HUNTER, glade: GLADE, drummer: DRUMMER } = CODES;
const HERO = "dh1";

describe("progressToVictory ends the game in the window of the attack that fills Drû-buri-Drû (06044:B:3)", () => {
  it("is won when the attack puts the last progress on the quest, and the engine offers the Resolution, not a stalled attack window", () => {
    const made = table({ stage: STAGE_3, phase: "PlayerAttacks", progress: 12, engaged: [{ code: DRU, progress: 4 }] });
    const hero = idOf(made.state, HERO);
    const hero2 = idOf(made.state, "dh2");
    const boosted = ["willpower"].flatMap(() => [hero, hero2]).reduce((state, id) => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "willpower" as const, amount: 3, until: "endOfPhase" as const }] }), made.state);
    const sent = send(begin(boosted), { type: "DeclareAttackers", enemyId: idOf(made.state, DRU), attackerIds: [hero, hero2] }, made.ctx);
    const state = finish(sent, made.ctx).state;
    expect(state.cards[idOf(made.state, DRU)]?.zone).toBe("victory");
    expect(state.stageCleared).toBe(true);
    expect(state.window === null || state.window.kind === "resolution").toBe(true);
  });
});

describe("hasResources: false (06048:A:2, 06053:A:2)", () => {
  it("leaves out each hero with a resource, so a count reads the heroes with none", () => {
    const made = table({ seats: 2, heroResources: 2 });
    const spec = { type: "hero" as const, control: "any" as const, hasResources: false };
    const empty = pickCandidates(made.state, spec, 0, [], null, made.ctx);
    const holding = pickCandidates(made.state, { ...spec, hasResources: true }, 0, [], null, made.ctx);
    expect(empty.every((id) => (made.state.cards[id]?.resources ?? 0) === 0)).toBe(true);
    expect(holding.every((id) => (made.state.cards[id]?.resources ?? 0) > 0)).toBe(true);
    expect(empty.length + holding.length).toBe(pickCandidates(made.state, { type: "hero", control: "any" }, 0, [], null, made.ctx).length);
  });
});

describe("archeryOf (06052:A:2)", () => {
  const amount = { archeryOf: { type: "enemy" as const, control: "any" as const, trait: "Wose", staging: true as const }, max: true as const };
  const read = (made: LayoutTable): number => resolveAmount(made.state, amount, { actor: 0, sourceId: null }, made.ctx);

  it("is 0 with no Wose, and the total archery of the Wose with the most otherwise: printed Archery plus the Glade's gain, not the sum of them all", () => {
    expect(read(table({ staging: [GLADE] }))).toBe(0);
    // The Elite prints Archery 2 and gains 1 from the Glade: 3. The Drummer prints none and gains 1.
    expect(read(table({ staging: [GLADE, DRUMMER] }))).toBe(1);
    expect(read(table({ staging: [GLADE, ELITE, DRUMMER] }))).toBe(3);
  });

  it("reads what a card gives itself too, so the Hunter counts the heroes with no resources, and two Glades add their gains", () => {
    const hunter = table({ staging: [GLADE, HUNTER] });
    const heroesWithNone = hunter.state.seats[0]?.heroes.filter((id) => (hunter.state.cards[id]?.resources ?? 0) === 0).length ?? 0;
    expect(read(hunter)).toBe(heroesWithNone + 1);
    expect(read(table({ staging: [GLADE, GLADE, ELITE] }))).toBe(4);
  });
});

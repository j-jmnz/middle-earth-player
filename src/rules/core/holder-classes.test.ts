// Rules: rr.traits, rr.lasting-effects, faq.lasting-effects (data/rules/entries.json).
// A lasting effect that names a Trait ("each Harad enemy gets +1 Attack", "each Ship location in the staging area gets +1 Threat") reaches a card that gained the Trait too.
import { describe, expect, it } from "vitest";

import { cardMap, fixtureDefinition } from "./test-fixture.ts";
import { addClassModifier, heldAmountByClass, traitedEnemies, traitedLocations, traitedStaging } from "./holder-classes.ts";
import { hasTrait } from "../interpret/conditions.ts";
import { modifiedStat } from "./keywords.ts";
import { definePrinted } from "./printed.ts";
import { blankScenario, type ScenarioState } from "./state.ts";
import { spawn } from "./zones.ts";

const raider = definePrinted({ code: "raider", name: "Raider", type: "enemy", traits: ["Orc"], attack: 2, defense: 1, health: 3, threat: 1, engagementCost: 30 });
const harad = definePrinted({ code: "harad", name: "Harad Scout", type: "enemy", traits: ["Harad"], attack: 2, defense: 1, health: 3, threat: 1, engagementCost: 30 });
const shore = definePrinted({ code: "shore", name: "Shore", type: "location", traits: ["Ship"], threat: 1, questPoints: 2 });
const cards = cardMap([raider, harad, shore]);

function table(): ScenarioState {
  return blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
}

// The Trait a card gains from a lasting effect (a traitGained modifier on the card).
function gains(state: ScenarioState, id: string, trait: string): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: "gift", stat: "traitGained", amount: 1, until: "endOfRound", trait }] };
}

describe("a class of cards named by a Trait reads the Traits a card has now", () => {
  it("gives +1 Attack to an enemy that gained the Harad Trait, as to a printed one (144029:A:1)", () => {
    const base = spawn(table(), "raider", { zone: "engaged", seat: 0 });
    const printed = spawn(base.state, "harad", { zone: "engaged", seat: 0 });
    const held = addClassModifier(gains(printed.state, base.id, "Harad"), traitedEnemies("Harad"), "effect", "attack", 1, "endOfRound");
    expect(modifiedStat(held, held.cards[base.id]!, "attack", cards)).toBe(3);
    expect(modifiedStat(held, held.cards[printed.id]!, "attack", cards)).toBe(3);
    const lacking = addClassModifier(printed.state, traitedEnemies("Harad"), "effect", "attack", 1, "endOfRound");
    expect(modifiedStat(lacking, lacking.cards[base.id]!, "attack", cards)).toBe(2);
  });

  it("gives +1 Threat to a staged location that gained the Ship Trait (145040:A:2) and a located one in play (900707:A:2)", () => {
    const base = spawn(table(), "raider", { zone: "staging" });
    const place = spawn(base.state, "shore", { zone: "staging" });
    const ship = addClassModifier(gains(place.state, base.id, "Ship"), traitedStaging("Ship"), "effect", "threat", 1, "endOfPhase");
    expect(modifiedStat(ship, ship.cards[place.id]!, "threat", cards)).toBe(2);
    // The enemy gained a Trait of locations, not their type: only enemies and locations are held, and it is an enemy that gained Ship.
    expect(modifiedStat(ship, ship.cards[base.id]!, "threat", cards)).toBe(2);
    const here = addClassModifier(gains(place.state, base.id, "Ship"), traitedLocations("Ship"), "effect", "threat", 1, "endOfRound");
    expect(modifiedStat(here, here.cards[place.id]!, "threat", cards)).toBe(2);
    expect(modifiedStat(here, here.cards[base.id]!, "threat", cards)).toBe(1);
  });

  it("reads the Trait a card gained in the amount a class holds (archery of the Harad enemies, 144039:A:1)", () => {
    const base = spawn(table(), "raider", { zone: "engaged", seat: 0 });
    const held = addClassModifier(gains(base.state, base.id, "Harad"), traitedEnemies("Harad"), "effect", "archery", 2, "endOfRound");
    expect(heldAmountByClass(held, held.cards[base.id]!, raider, "archery", (trait) => hasTrait(held, base.id, trait, { effects: [], cards }))).toBe(2);
    expect(heldAmountByClass(held, held.cards[base.id]!, raider, "archery")).toBe(0);
  });
});

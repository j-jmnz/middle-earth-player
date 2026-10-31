// Rules: dcce.aflame, dcce.stormcaller-elite, rr.the-word-choose, rr.first-player (data/rules/entries.json). Every choice a Raid on the Grey Havens record asks reads as a sentence on the table: each branch of a Choose,
// each prompt of a Pick (it names the card it is about and states the damage), and the questions the aflame family's verbs ask (the Aflame location searched for, the location that has damage removed), with no bare
// option id.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../effects/authored/raid-on-the-grey-havens.ts";
import { RECORDS as DCCE_RECORDS } from "../effects/authored/pool/DCCE.ts";
import { CODES, idOf, loadRaidWorld, raidTable, type RaidWorld } from "../../scripts/raid-scene.ts";

import { aflameWords, branchNow, dealtNow } from "./aflame-words.ts";
import { branchWords, pickWords, type ChoiceNames } from "./choice-words.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };
const records: readonly Effect[] = [...AUTHORED_EFFECTS, ...DCCE_RECORDS.filter((effect) => ["11183", "11184", "11185", "11186", "11187", "11189", "11190"].includes(effect.cardCode))];

function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1]);
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of the Raid on the Grey Havens choices", () => {
  it("every Choose names each branch in a sentence", () => {
    const made = raidTable(world, {});
    const seen: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z0-9][A-Za-z0-9']* .+/);
          seen.push(words);
        }
      });
    }
    expect(seen).toContain("Deal 2 damage to an Aflame location in play");
    expect(seen).toContain("Search the encounter deck and discard pile for the Aflame location with the highest Aflame value, and add it to the staging area");
    expect(seen).toContain("Deal 3 damage to 11044");
    expect(seen).toContain("Add the topmost enemy in the encounter discard pile to the staging area");
    expect(seen).toContain("Deal 3 damage to a character you control");
    expect(seen).toContain("Deal 3 damage to an Aflame location in play");
    expect(seen).toContain("Deal 3 damage to the active location");
    expect(seen).toContain("Deal 1 damage to the defending character");
    expect(seen).toContain("Toss the axe: it missed (once per game)");
    expect(seen).toContain("Deal 1 damage to an enemy (once per game)");
    expect(seen).toContain("Toss the axe: it stopped on an enemy. Deal 4 damage to that enemy (once per game)");
    expect(seen).toContain("11079 gets +2 Attack for this attack");
    expect(seen).toContain("11079 gets +2 Defense for this attack");
    expect(seen.some((entry) => entry.startsWith("Look at the top X cards of your deck"))).toBe(true);
    expect(seen).toContain("Put it on the bottom of your deck");
  });

  it("every Pick that asks a player says what the card is for and states the damage", () => {
    let picks = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        picks += 1;
        const words = pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
      });
    }
    expect(picks).toBeGreaterThanOrEqual(15);
  });

  it("the Aflame pick names the damage it takes, read now when it depends on the table, and the lowest value when locations are tied", () => {
    const made = raidTable(world, { phase: "Combat", staging: ["corsair", "corsair2", "ship"] });
    const pick = AUTHORED_EFFECTS.find((effect) => effect.id === "11036:forced:1")?.instructions ?? [];
    const [choose, damage] = pick;
    if (choose?.verb !== "Pick" || damage?.verb !== "DamageCard") throw new Error("11036:forced:1 changed");
    const now = dealtNow(made.state, made.ctx, damage, 0, made.state.questStage);
    expect(now).toBe(3);
    const words = pickWords(choose, damage, names, CODES.assault, 2, made.state, now);
    expect(words).toEqual({ verb: "Burn", prompt: "11036: choose the Aflame location that takes 3 damage. They are tied on the lowest Aflame value." });
    const search = pickWords({ verb: "SearchAflame" }, undefined, names, CODES.arsonist);
    expect(search.prompt).toBe("11040: choose the Aflame location to add to the staging area. They are tied on the highest Aflame value.");
    const heal = pickWords({ verb: "HealLocations", amount: 4, healed: 1 }, undefined, names, CODES.advance);
    expect(heal.prompt).toBe("11037: choose the location that has 1 damage removed (damage 2 of 4).");
  });

  it("each verb of the family reads as a clause", () => {
    expect(aflameWords({ verb: "DiscardUntilAflame", perPlayer: 1 })).toBe("discard cards from the encounter deck until an Aflame location for each player is discarded, and add them to the staging area");
    expect(aflameWords({ verb: "EngageFirstPlayer" })).toBe("it engages the first player");
    expect(aflameWords({ verb: "RemoveNamedFromGame", name: "Calphon" })).toBe("remove Calphon and each attachment on him from the game");
    expect(aflameWords({ verb: "HealLocations", amount: { x: true } })).toBe("remove X damage from locations in play");
    expect(aflameWords({ verb: "Draw" })).toBeNull();
  });

  it("Galdor's Counsel states the real number: the cards a Lore Counsel looks at, the progress, the resources and the damage, computed when the sheet is built", () => {
    // Lore at level 3 (half rounded up is 2) with two copies chosen at the Setup: 4 cards. Spirit and Tactics at level 2: 4.
    const made = raidTable(world, { staging: ["f3", "place"], hand: [CODES.counselLore, CODES.counselTactics, CODES.counselSpirit, CODES.counselLeadership], chosen: [[CODES.counselLore, 0], [CODES.counselLeadership, 0]] });
    const state = { ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.counselLore]: 3, [CODES.counselSpirit]: 2, [CODES.counselTactics]: 2, [CODES.counselLeadership]: 3 } } };
    const lore = idOf(state, CODES.counselLore);
    const effect = DCCE_RECORDS.find((entry) => entry.cardCode === CODES.counselLore);
    const choose = effect?.instructions[0];
    if (choose?.verb !== "Choose") throw new Error("11187 changed");
    const now = branchNow(state, made.ctx, choose, 0, lore, null, names);
    expect(now.count).toBe(4);
    expect(branchWords(choose, "top", state, names, lore, now)).toBe("Look at the top 4 cards of your deck");
    expect(branchWords(choose, "bottom", state, names, lore, now)).toBe("Look at the bottom 4 cards of your deck");
    // The placement names the card being placed (the one the last Pick chose).
    const picked = idOf(state, "f3");
    const placing = branchNow(state, made.ctx, choose, 0, lore, picked, { card: () => "Gandalf" });
    const repeat = effect?.instructions.find((step) => step.verb === "Repeat");
    const put = repeat?.verb === "Repeat" ? repeat.instructions.find((step) => step.verb === "Choose") : undefined;
    if (put?.verb !== "Choose") throw new Error("11187 changed");
    expect(branchWords(put, "top", state, names, lore, placing)).toBe("Put Gandalf on the top of your deck");
    expect(branchWords(put, "bottom", state, names, lore, placing)).toBe("Put Gandalf on the bottom of your deck");
    const pick = (code: string, verb: "AddResources" | "DamageCard" | "PlaceProgressOn") => {
      const record = DCCE_RECORDS.find((entry) => entry.cardCode === code);
      const [first, second] = record?.instructions ?? [];
      if (first?.verb !== "Pick" || second?.verb !== verb) throw new Error(`${code} changed`);
      return { first, second, now: dealtNow(state, made.ctx, second, 0, idOf(state, code)) };
    };
    const tactics = pick(CODES.counselTactics, "DamageCard");
    expect(tactics.now).toBe(4);
    expect(pickWords(tactics.first, tactics.second, names, CODES.counselTactics, 2, state, tactics.now).prompt).toBe("Choose an enemy to take 4 damage.");
    const spirit = pick(CODES.counselSpirit, "PlaceProgressOn");
    expect(pickWords(spirit.first, spirit.second, names, CODES.counselSpirit, 2, state, spirit.now).prompt).toBe("Choose a location to place 4 progress on.");
    const leadership = pick(CODES.counselLeadership, "AddResources");
    expect(pickWords(leadership.first, leadership.second, names, CODES.counselLeadership, 2, state, leadership.now).prompt).toBe("Choose a hero to add 4 resources to.");
  });

  it("the Throwing Axe's follow-up pick asks for the enemy the axe stopped on, and Put to the Torch's character pick names the card and says 'you control'", () => {
    const withAxe = raidTable(world, { play: [CODES.axe] });
    const axe = idOf(withAxe.state, CODES.axe);
    const here: ChoiceNames = { card: (id) => withAxe.state.cards[id]?.code ?? id, code: names.code };
    const record = DCCE_RECORDS.find((entry) => entry.id === "11190:action:1");
    const choose = record?.instructions[0];
    if (choose?.verb !== "Choose") throw new Error("11190 changed");
    const hit = choose.options.find((option) => option.id === "hit")?.instructions ?? [];
    const damage = choose.options.find((option) => option.id === "damage")?.instructions ?? [];
    expect(pickWords(hit[0]!, hit[1], here, axe, 2, withAxe.state).prompt).toBe("11190: choose the enemy the axe stopped on. It takes 4 damage.");
    expect(pickWords(damage[0]!, damage[1], here, axe, 2, withAxe.state).prompt).toBe("11190: choose the enemy that takes 1 damage.");
    const torch = AUTHORED_EFFECTS.find((effect) => effect.id === "11048:whenRevealed:1");
    const each = torch?.instructions[0];
    const outer = each?.verb === "ForEachPlayer" ? each.instructions[0] : undefined;
    if (outer?.verb !== "Choose") throw new Error("11048 changed");
    const character = outer.options.find((option) => option.id === "character")?.instructions ?? [];
    const revealed = raidTable(world, { staging: [CODES.torch] });
    const there: ChoiceNames = { card: () => "Put to the Torch", code: names.code };
    expect(pickWords(character[0]!, character[1], there, idOf(revealed.state, CODES.torch), 2, revealed.state).prompt).toBe("Put to the Torch: choose a character you control to take 3 damage.");
  });
});

// Rules: rr.guarded, rr.first-player (data/rules/entries.json). Every choice a record of A Storm on Cobas Haven asks (src/effects/authored/a-storm-on-cobas-haven.ts) reads as a sentence on the table: no bare option
// id and no "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/a-storm-on-cobas-haven.ts";
import { RECORDS as SEND_FOR_HELP } from "../../effects/authored/pool/DCCEHaven.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { addStandIns, allyCard } from "../../../test/harness/scene-kit.ts";
import { CODES, havenTable, idOf, idsOf, legalIntents, loadHavenWorld, resolveRecords, type HavenLayout, type HavenWorld } from "../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { delayedLines } from "../cards/card-effects.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";

let world: HavenWorld;

beforeAll(async () => {
  world = await loadHavenWorld();
  addStandIns(world.cards, ["mild"]);
  world.cards.set("ally1", allyCard("ally1", 1, { willpower: 1 }));
  world.cards.set("ally2", allyCard("ally2", 1, { willpower: 2 }));
  for (const [code, card] of await loadPrinted([CODES.dreamChaser, CODES.dawnStar, "01001", "01002", "01073", "04053", "09001"])) world.cards.set(code, card);
}, 120_000);

// Every instruction a record holds, nested ones too, each with the instruction that follows it in its list.
function walk(instructions: readonly Instruction[], visit: (instruction: Instruction, next: Instruction | undefined, after: readonly Instruction[]) => void): void {
  instructions.forEach((instruction, index) => {
    visit(instruction, instructions[index + 1], instructions.slice(index + 2));
    if ("instructions" in instruction && Array.isArray(instruction.instructions)) walk(instruction.instructions, visit);
    if (instruction.verb === "Choose") for (const option of instruction.options) walk(option.instructions, visit);
  });
}

describe("the words of A Storm on Cobas Haven choices", () => {
  const names = (): ChoiceNames => ({ card: (id) => world.cards.get(id)?.name ?? id, code: (code) => world.cards.get(code)?.name ?? code });
  // The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
  const ASKING = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower"]);

  it("every instruction that asks a player says what the card is for, in a sentence of its own", () => {
    const prompts: string[] = [];
    for (const effect of AUTHORED_EFFECTS) {
      walk(effect.instructions, (instruction, next, after) => {
        if (!ASKING.has(instruction.verb)) return;
        // A ReturnToStaging of the picked enemy sends it back without a question: the Pick before it asks.
        if (instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose")) return;
        const words = pickWords(instruction, next, names(), effect.cardCode, 2, undefined, undefined, after);
        expect(words.prompt, effect.id).toMatch(/^[A-Z].*\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    // Siege Ship and The Raiders' Assault: without the table the objective's guard is the source's name, or the generic sentence when the enemy picked before is not known.
    expect(prompts).toContain("Choose the unguarded objective Siege Ship guards.");
    expect(prompts).toContain("Choose an unguarded objective in the staging area to guard.");
    expect(prompts).toContain("Choose a non-unique Ship enemy to attach to the objective as its guard.");
    expect(prompts).toContain("Choose a Ship enemy to attach to an unguarded objective as its guard. An engaged enemy returns to the staging area first.");
    expect(prompts).toContain("Choose a Dol Amroth objective from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose a Ship enemy from the encounter deck or discard pile to add to the staging area.");
    // Tower of the Gull (12135:A:3).
    expect(prompts).toContain("Choose a non-unique Ship enemy to take 2 damage.");
    // The stage's Forced effect (12120:B:2), Coast of Anfalas's Travel cost (12128:A:2), Belfalas Islet's Response (12129:A:2) and the Setup's objective (12120:A:1).
    expect(prompts).toContain("Choose the Ship objective you control that takes 2 damage.");
    expect(prompts).toContain("Choose a Ship objective to exhaust.");
    expect(prompts).toContain("Choose a Ship enemy that is not guarding an objective. While Belfalas Islet is the active location, it is considered to be out of play.");
    expect(prompts).toContain("Choose a Dol Amroth objective from the encounter deck or discard pile to add to the staging area.");
    // Corsair Skirmisher's Response (12125:A:3), Ramming Speed! (12131:A:1) and Taking on Water (12132:A:1, and its Action's three characters).
    expect(prompts).toContain("Choose an ally to discard. Discard allies you control with a total of at least 3 Willpower to take control of this card as a Ship objective.");
    expect(prompts).toContain("Choose which of the Ship enemies engaged with you, tied for the highest Attack, makes an immediate attack.");
    expect(prompts).toContain("Choose the Ship objective this card attaches to.");
    // Taking on Water's Action is read on the table below: the Repeat is expanded in the queue there.
    expect(prompts).toContain("Choose a character to exhaust.");
  });

  it("the engagement checks that ends in a tie ask the first player which enemy engages", () => {
    const tie = AUTHORED_EFFECTS.flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "MakeEngagementChecks");
    if (!tie) throw new Error("no MakeEngagementChecks record");
    expect(pickWords(tie, undefined, names(), "12122").prompt).toBe("Choose which of the enemies tied for the highest engagement cost the engagement check engages.");
  });

  // Gavin and the four Send for Help events (pool/DCCEHaven.ts): the player Send for Help (Leadership) names, the hero Send for Help (Tactics) takes from the collection and the player who takes it, and the phase Send for Help (Spirit) adds.
  it("the Send for Help cards ask for a player, a hero, a card and a phase in sentences of their own", () => {
    const prompts: string[] = [];
    for (const effect of SEND_FOR_HELP) {
      walk(effect.instructions, (instruction, next, after) => {
        if (!ASKING.has(instruction.verb) && !["PutIntoPlay", "TakeHeroFromCollection", "PlayFrom"].includes(instruction.verb)) return;
        const words = pickWords(instruction, next, names(), effect.cardCode, 2, undefined, undefined, after);
        if (instruction.verb === "PutIntoPlay" || instruction.verb === "TakeCardFromCollection") return;
        expect(words.prompt, effect.id).toMatch(/^[A-Z].*\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        prompts.push(words.prompt);
      });
    }
    expect(prompts).toContain("Choose a hero from your collection to put into play.");
    // Send for Help (Leadership): the player searches the top 10 cards for a card, then draws it or plays it for no cost.
    expect(prompts).toContain("Choose the player who searches the top 10 cards of their deck for a card.");
    expect(prompts).not.toContain("Choose a player.");
    expect(prompts).toContain("Choose a card from the top 10 cards of your deck to draw.");
    expect(prompts).toContain("Choose a card from the top 10 cards of your deck to play for no cost.");
  });

  it("every branch of a Choose a record asks says what it does: the phase Send for Help (Spirit) adds, and drawing or playing the card Send for Help (Leadership) finds", () => {
    const state = havenTable(world).state;
    const branches: string[] = [];
    for (const effect of [...AUTHORED_EFFECTS, ...SEND_FOR_HELP]) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, state, names(), null);
          expect(words, `${effect.id} ${option.id}`).not.toBe("");
          expect(words.toLowerCase(), `${effect.id} ${option.id}`).not.toBe(option.id.toLowerCase());
          branches.push(`${effect.id} ${words}`);
        }
      });
    }
    expect(branches).toEqual(expect.arrayContaining(["11211:whenRevealed:1 Draw a card from the top 10 cards of your deck", "11211:whenRevealed:1 Play a card from the top 10 cards of your deck for no cost", "11213:whenRevealed:1 An additional resource phase follows this phase", "11213:whenRevealed:1 An additional refresh phase follows this phase"]));
  });
});

// The sheets a record's choices open on the table (src/play/choice/sheets.ts), each answered by `answer` (the first option when it names none).
function sheetsOf(made: ReturnType<typeof havenTable>, code: string, timing: Parameters<typeof resolveRecords>[3], source: string | undefined, answer: (sheet: PickSheet, state: ScenarioState) => string | undefined = () => undefined): { sheets: PickSheet[]; state: ScenarioState } {
  const sheets: PickSheet[] = [];
  const pack = (cardCode: string): string | null => (cardCode.startsWith("01") ? "Core Set" : `Pack ${cardCode.slice(0, 2)}`);
  const run = resolveRecords(made.state, made.ctx, code, timing, source, (current) => {
    const names: SheetNames = { card: (id) => world.cards.get(current.cards[id]?.code ?? id)?.name ?? id, line: () => null, pack };
    const sheet = sheetFor(current, made.ctx, legalIntents(current, made.ctx), names);
    if (sheet?.kind !== "pick") throw new Error(`no pick sheet for ${current.window?.kind}`);
    sheets.push(sheet);
    return answer(sheet, current) ?? sheet.options[0]?.id ?? "";
  });
  return { sheets, state: run.state };
}
const notes = (sheets: readonly PickSheet[]): string[] => sheets.map((sheet) => sheet.note ?? "");
const labels = (sheet: PickSheet | undefined): string[] => (sheet?.options ?? []).map((option) => option.label);

describe("the Send for Help cards on the table", () => {
  it("11211 (Leadership) names what the player picked does, then draws or plays from the top 10 cards of their deck", () => {
    const made = havenTable(world, { staging: ["11211"], seats: 2, deckOf: Array.from({ length: 12 }, (_, at) => (at % 2 === 0 ? "ally1" : "ally2")) });
    const { sheets } = sheetsOf(made, "11211", "whenRevealed", idOf(made.state, "11211"), (sheet) => (sheet.options.some((option) => option.id === "draw") ? "draw" : undefined));
    const text = notes(sheets).join("\n");
    expect(text).toContain("Choose the player who searches the top 10 cards of their deck for a card.");
    expect(labels(sheets.find((sheet) => sheet.options.some((option) => option.id === "draw")))).toEqual(["Draw a card from the top 10 cards of your deck", "Play a card from the top 10 cards of your deck for no cost"]);
    expect(text).toContain("Choose a card from the top 10 cards of your deck to draw.");
    expect(text).not.toContain("Choose a player.");
  });

  it("11212 (Tactics) lists the collection by name, tells heroes of one title apart by sphere and pack, and names the hero and the end of the round when it asks who controls it", () => {
    const made = havenTable(world, { staging: ["11212"], seats: 2 });
    const { sheets, state } = sheetsOf(made, "11212", "whenRevealed", idOf(made.state, "11212"), (sheet, current) => sheet.options.map((option) => option.id).find((id) => current.cards[id]?.code === "01001"));
    const list = labels(sheets[0]);
    const base = list.map((label) => label.split(" · ")[0] ?? "");
    expect(base).toEqual([...base].sort((left, right) => left.localeCompare(right)));
    // Every title offered more than once carries its sphere and its pack; a title offered once is its bare name.
    for (const label of list) {
      const title = label.split(" · ")[0] ?? "";
      expect(label.includes(" · "), label).toBe(base.filter((other) => other === title).length > 1);
    }
    // Three Aragorns are offered: the Core Set's is told from the others by its sphere and its pack.
    expect(list).toContain("Aragorn · Leadership · Core Set");
    expect(list.filter((label) => label.startsWith("Aragorn")).length).toBe(3);
    expect(list).toContain("Théodred");
    expect(notes(sheets).join("\n")).toContain("Choose the player who controls Aragorn until the end of the round.");
    // The hero leaves the game with the round: its card says so.
    const hero = idsOf(state, "01001").find((id) => state.cards[id]?.zone === "heroes") ?? "";
    expect(delayedLines(state, hero, (id) => world.cards.get(state.cards[id]?.code ?? "")?.name ?? id).join("|")).toContain("At the end of the round: is removed from the game");
  });

  it("11214 (Lore) names Gandalf", () => {
    const made = havenTable(world, { staging: ["11214"], seats: 2 });
    const { sheets } = sheetsOf(made, "11214", "whenRevealed", idOf(made.state, "11214"));
    expect(notes(sheets).join("\n")).toContain("Choose the player who controls Gandalf.");
  });
});

// Taking on Water attached to the Dream-chaser (12132:A:1), with the damage it already holds.
function soaked(layout: HavenLayout, damage = 0) {
  const made = havenTable(world, { play: [CODES.dreamChaser], ...layout });
  const ship = idOf(made.state, CODES.dreamChaser);
  const water = spawn(made.state, CODES.takingOnWater, { zone: "attached" });
  const state = syncConstants(updateCard(attachTo(water.state, water.id, ship), ship, { damage }), made.ctx);
  return { made: { ...made, state }, ship, water: water.id };
}

describe("the costs and Actions that exhaust ships on the table", () => {
  it("Taking on Water's Action counts the three characters, and the ship it sits on warns of its damage, with the loss when that destroys the Dream-chaser", () => {
    const { made, ship, water } = soaked({ play: [CODES.dreamChaser, "ally1", "ally1"] });
    const { sheets } = sheetsOf(made, CODES.takingOnWater, "action", water);
    expect(notes(sheets)).toEqual([
      "Choose a character you control to exhaust (1 of 3) to discard Taking on Water.",
      "Choose a character you control to exhaust (2 of 3) to discard Taking on Water.",
      "Choose a character you control to exhaust (3 of 3) to discard Taking on Water.",
    ].map((prompt) => expect.stringContaining(prompt)));
    expect(sheets[0]?.options.find((option) => option.id === ship)?.caution).toBe("Tap again: Taking on Water: 2 damage to Dream-chaser");
    expect(sheets[0]?.options.filter((option) => option.id !== ship).every((option) => option.caution == null)).toBe(true);
    const doomed = soaked({ play: [CODES.dreamChaser, "ally1", "ally1"] }, 17);
    const lost = sheetsOf(doomed.made, CODES.takingOnWater, "action", doomed.water);
    expect(lost.sheets[0]?.options.find((option) => option.id === doomed.ship)?.caution).toBe("Tap again: Taking on Water: 2 damage destroys Dream-chaser and the game is lost");
  });

  it("Coast of Anfalas's Travel cost names the ship to exhaust, the damage Taking on Water would deal, and whose each ship is when the players hold more than one", () => {
    const { made } = soaked({ seats: 2 });
    const second = spawn(made.state, CODES.dawnStar, { zone: "play", seat: 1 });
    const table = { ...made, state: syncConstants(second.state, made.ctx) };
    const { sheets } = sheetsOf({ ...table, state: spawn(table.state, CODES.coastOfAnfalas, { zone: "staging" }).state }, CODES.coastOfAnfalas, "travel", undefined);
    expect(sheets[0]?.note).toContain("Choose a Ship objective to exhaust to travel to Coast of Anfalas.");
    expect(labels(sheets[0])).toEqual(["Dream-chaser · Player 1", "Dawn Star · Player 2"]);
    expect(sheets[0]?.options[0]?.caution).toBe("Tap again: Taking on Water: 2 damage to Dream-chaser");
    expect(sheets[0]?.options[1]?.caution).toBeUndefined();
  });

  it("Taking on Water's When Revealed names whose ship each is when there are two players' ships", () => {
    const base = havenTable(world, { seats: 2, play: [CODES.dreamChaser] });
    const second = spawn(base.state, CODES.dawnStar, { zone: "play", seat: 1 });
    const made = { ...base, state: syncConstants(second.state, base.ctx) };
    const { sheets } = sheetsOf(made, CODES.takingOnWater, "whenRevealed", undefined);
    expect(labels(sheets[0])).toEqual(["Dream-chaser · Player 1", "Dawn Star · Player 2"]);
    // Alone the player's ships need no owner.
    const solo = havenTable(world, { play: [CODES.dreamChaser, CODES.dawnStar] });
    expect(labels(sheetsOf(solo, CODES.takingOnWater, "whenRevealed", undefined).sheets[0])).toEqual(["Dream-chaser", "Dawn Star"]);
  });
});

describe("the Corsair cards on the table", () => {
  it("Corsair Skirmisher's discard shows the Willpower still needed", () => {
    const made = havenTable(world, { engaged: [CODES.corsairSkirmisher], play: ["ally2", "ally1", "ally1"] });
    const { sheets } = sheetsOf(made, CODES.corsairSkirmisher, "response", idOf(made.state, CODES.corsairSkirmisher), (sheet, current) => sheet.options.map((option) => option.id).find((id) => current.cards[id]?.code === "ally2"));
    expect(notes(sheets)[0]).toContain("Corsair Skirmisher: choose an ally to discard. At least 3 Willpower is needed to take control of it as a Ship objective.");
    expect(notes(sheets)[1]).toContain("Corsair Skirmisher: choose another ally to discard. At least 1 more Willpower is needed to take control of it as a Ship objective.");
  });

  it("the engagement checks that tie name the seat whose check it is", () => {
    const made = havenTable(world, { seats: 2, threat: [50, 50], staging: [CODES.scoutingShip, CODES.scoutingShip, CODES.scoutingShip, CODES.scoutingShip], stage: "12122" });
    const { sheets } = sheetsOf(made, "12122", "whenRevealed", idOf(made.state, "12122"));
    expect(notes(sheets)[0]).toContain("Choose the enemy that engages Player 1. These are tied for the highest engagement cost.");
    expect(notes(sheets)[1]).toContain("Choose the enemy that engages Player 2. These are tied for the highest engagement cost.");
    const solo = havenTable(world, { threat: [50, 50], staging: [CODES.scoutingShip, CODES.scoutingShip], stage: "12122" });
    expect(notes(sheetsOf(solo, "12122", "whenRevealed", idOf(solo.state, "12122")).sheets)[0]).toContain("Choose the enemy that engages you. These are tied");
  });

  it("Tower of the Gull damages a non-unique Ship enemy, and says so", () => {
    const base = havenTable(world, { staging: [CODES.towerOfTheGull, CODES.scoutingShip, CODES.corsairWarship], phase: "Combat" });
    const gull = idOf(base.state, CODES.towerOfTheGull);
    const made = { ...base, state: updateCard(base.state, gull, { claimed: true }) };
    const { sheets } = sheetsOf(made, CODES.towerOfTheGull, "action", gull);
    expect(notes(sheets)[0]).toContain("Choose a non-unique Ship enemy to take 2 damage.");
  });

  it("the guard prompts name the objective and the enemy that guards", () => {
    const bay = havenTable(world, { stage: "12121", staging: [CODES.towerOfTheGull, CODES.scoutingShip, CODES.scoutingShip] });
    expect(notes(sheetsOf(bay, "12121", "whenRevealed", idOf(bay.state, "12121")).sheets).join("\n")).toContain("Choose a non-unique Ship enemy to attach to Tower of the Gull as its guard.");
    const siege = havenTable(world, { staging: [CODES.siegeShip, CODES.seaWardTower, CODES.towerOfTheGull] });
    expect(notes(sheetsOf(siege, CODES.siegeShip, "forced", idOf(siege.state, CODES.siegeShip)).sheets)[0]).toContain("Choose the unguarded objective Siege Ship guards.");
    const raid = havenTable(world, { staging: [CODES.scoutingShip, CODES.seaWardTower, CODES.towerOfTheGull] });
    expect(notes(sheetsOf(raid, CODES.theRaidersAssault, "whenRevealed", undefined).sheets).join("\n")).toContain("Choose the unguarded objective Scouting Ship guards.");
  });

  it("a search reads the encounter deck alone in the Setup, and the deck or the discard pile when a card is revealed", () => {
    // The Setup's search is the record's own (12120:A:1) without the fleet, which needs the whole scenario dealt.
    const base = havenTable(world, { deck: [CODES.seaWardTower, CODES.towerOfTheGull] });
    const record = base.ctx.effects.find((effect) => effect.id === "12120:setup:1");
    const setup = { ...base, ctx: { ...base.ctx, effects: record ? [{ ...record, instructions: record.instructions.filter((instruction) => instruction.verb === "SearchMove") }] : [] } };
    expect(notes(sheetsOf(setup, "12120", "setup", undefined).sheets).join("\n")).toContain("Choose a Dol Amroth objective from the encounter deck to add to the staging area.");
    const cruiser = havenTable(world, { deck: [CODES.seaWardTower, CODES.towerOfTheGull] });
    expect(notes(sheetsOf(cruiser, CODES.heavyCruiser, "whenRevealed", undefined).sheets).join("\n")).toContain("Choose a Dol Amroth objective from the encounter deck or discard pile to add to the staging area.");
  });
});

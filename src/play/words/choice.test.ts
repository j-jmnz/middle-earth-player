// Rules: rr.first-player (data/rules/entries.json). Every choice a Passage Through Mirkwood record asks (src/effects/authored/passage-through-mirkwood.ts,
// src/effects/authored/pool/RevCore.ts) and Caught in a Web's refresh choice (01080:A:1) reads as a sentence on the table: no bare option id and no
// "Choose a character." that does not say what the card is for.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as OATH_EFFECTS } from "../../effects/authored/the-oath.ts";
import { RECORDS as TDOM_RECORDS } from "../../effects/authored/pool/TDoM.ts";
import { AUTHORED_EFFECTS as DOL_GULDUR_EFFECTS } from "../../effects/authored/escape-from-dol-guldur.ts";
import { AUTHORED_EFFECTS as ANDUIN_EFFECTS } from "../../effects/authored/journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS } from "../../effects/authored/passage-through-mirkwood.ts";
import { RECORDS as POOL_RECORDS } from "../../effects/authored/pool/RevCore.ts";
import { stageNumber } from "../../rules/families/caves/progress.ts";
import { alternativeActions } from "../../rules/families/deck/play.ts";
import { readyPaymentChoice } from "../../rules/families/attachments/ready.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { HERO, loadMirkwoodWorld, mirkwoodTable, type MirkwoodWorld } from "../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { anduinTable, loadAnduinWorld, type AnduinWorld } from "../../../test/scenarios/journey-along-the-anduin/scene.ts";
import { dolGuldurTable, loadDolGuldurWorld, type DolGuldurWorld } from "../../../test/scenarios/escape-from-dol-guldur/scene.ts";
import { loadOathWorld, oathTable, type OathWorld } from "../../../test/scenarios/the-oath/scene.ts";
import { AUTHORED_EFFECTS as CAVES_EFFECTS } from "../../effects/authored/the-caves-of-nibin-dum.ts";
import { cavesTable, loadCavesWorld, type CavesWorld } from "../../../test/scenarios/the-caves-of-nibin-dum/scene.ts";

import { legalIntents } from "../../rules/engine/legal.ts";
import { first, send, start } from "../../../test/harness/scene-kit.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { sheetFor } from "../choice/sheets.ts";
import { ASKING_VERBS, walk } from "../../../test/harness/record-walk.ts";

let world: MirkwoodWorld;
let anduinWorld: AnduinWorld;
let dolGuldurWorld: DolGuldurWorld;
let oathWorld: OathWorld;

beforeAll(async () => {
  world = await loadMirkwoodWorld();
  anduinWorld = await loadAnduinWorld();
  dolGuldurWorld = await loadDolGuldurWorld();
  oathWorld = await loadOathWorld();
});

const names: ChoiceNames = { card: (id) => id, code: (code) => world.cards.get(code)?.name ?? code };

const passage: readonly Effect[] = [...AUTHORED_EFFECTS, ...POOL_RECORDS];

describe("the words of the Passage Through Mirkwood choices", () => {
  it("every Pick that asks a player says what the card is for", () => {
    let picks = 0;
    for (const effect of passage) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        picks += 1;
        const words = pickWords(instruction, next, names, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.verb, effect.id).not.toBe("Choose");
      });
    }
    expect(picks).toBeGreaterThan(0);
  });

  it("every Choose names each branch in a sentence", () => {
    const made = mirkwoodTable(world);
    let branches = 0;
    for (const effect of passage) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          branches += 1;
          const words = branchWords(instruction, option.id, made.state, names, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id.charAt(0).toUpperCase() + option.id.slice(1));
        }
      });
    }
    expect(branches).toBeGreaterThan(0);
  });

  it("Lingering Venom's exhaust and damage branches and the pick for the damage", () => {
    const venom = passage.find((effect) => effect.id === "01137:whenRevealed:1");
    const choose: Instruction[] = [];
    const picks: string[] = [];
    walk(venom?.instructions ?? [], (instruction, next) => {
      if (instruction.verb === "Choose") choose.push(instruction);
      if (instruction.verb === "Pick") picks.push(pickWords(instruction, next, names, "01137").prompt);
    });
    const made = mirkwoodTable(world);
    const [only] = choose;
    if (only?.verb !== "Choose") throw new Error("no Choose in 01137:whenRevealed:1");
    expect(branchWords(only, "exhaust", made.state, names, "01137")).toBe("Exhaust each damaged character you control");
    expect(picks).toEqual(["Choose a hero to take 2 damage."]);
  });
});

describe("Caught in a Web's refresh choice (01080:A:1)", () => {
  it("names the host, says what paying costs and what skipping costs", () => {
    const made = mirkwoodTable(world);
    const hero = first(made.state, HERO);
    const web = spawn(made.state, "01080", { zone: "play", seat: 0 });
    const state = attachTo(web.state, web.id, hero);
    const choose = readyPaymentChoice(2);
    if (choose.verb !== "Choose") throw new Error("not a Choose");
    const named: ChoiceNames = { card: (id) => (id === hero ? "Aragorn" : id), code: names.code };
    expect(branchWords(choose, "pay", state, named, web.id)).toBe("Pay 2 resources from Aragorn's pool and ready Aragorn");
    expect(branchWords(choose, "skip", state, named, web.id)).toBe("Leave Aragorn exhausted this round");
  });
});

// Every record of Journey Along the Anduin (src/effects/authored/journey-along-the-anduin.ts) and its Valor and Scarred (pool/RevCore.ts).
const anduin: readonly Effect[] = [...ANDUIN_EFFECTS, ...POOL_RECORDS.filter((effect) => effect.cardCode === "01133" || effect.cardCode === "01138")];

describe("the words of the Journey Along the Anduin choices", () => {
  const anduinNames: ChoiceNames = { card: (id) => id, code: (code) => anduinWorld.cards.get(code)?.name ?? code };

  it("every Pick that asks a player says what the card is for", () => {
    const prompts: string[] = [];
    for (const effect of anduin) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        const words = pickWords(instruction, next, anduinNames, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    // Goblin Sniper's damage, Pursued by Shadow's ally, and the hero that carries Valor and Scarred.
    expect(prompts).toContain("Choose a character to take 1 damage.");
    expect(prompts).toContain("Choose an ally to return to its owner's hand.");
    expect(prompts).toContain("Choose a hero to carry Valor.");
    expect(prompts).toContain("Choose a hero to carry Scarred.");
  });

  it("every Choose names each branch in a sentence", () => {
    const made = anduinTable(anduinWorld);
    for (const effect of anduin) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) expect(branchWords(instruction, option.id, made.state, anduinNames, effect.cardCode), `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
      });
    }
  });

  it("the new verbs read as sentences when a record offers them in a choice", () => {
    const made = anduinTable(anduinWorld);
    type Branch = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"][number];
    const say = (instruction: Branch): string => branchWords({ verb: "Choose", who: "actor", options: [{ id: "x", instructions: [instruction] }] }, "x", made.state, anduinNames, null);
    expect(say({ verb: "RemoveProgressFromQuest", amount: 4 })).toBe("Remove 4 progress from the quest");
    expect(say({ verb: "ShadowAttacks" })).toBe("Attack the defending player once this attack has ended");
    expect(say({ verb: "SetAsideEachPlayer", code: "01133" })).toBe("Set aside a copy of Valor for each player");
    expect(say({ verb: "AttachSetAside", code: "01138" })).toBe("Attach a set-aside Scarred to it");
    expect(say({ verb: "EarnAttached", codes: ["01133", "01138"] })).toBe("Add each Valor and Scarred in play to the Campaign Pool, on its hero");
    expect(say({ verb: "NamePrisoner" })).toBe("Take the hero with the most damage prisoner");
  });
});

// Every record of Escape from Dol Guldur (src/effects/authored/escape-from-dol-guldur.ts), Appointed by Fate and Mendor's pool record (pool/RevCore.ts).
const dolGuldur: readonly Effect[] = [...DOL_GULDUR_EFFECTS, ...POOL_RECORDS.filter((effect) => effect.cardCode === "01134" || effect.cardCode === "01135")];

describe("the words of the Escape from Dol Guldur choices", () => {
  const dolNames: ChoiceNames = { card: (id) => id, code: (code) => dolGuldurWorld.cards.get(code)?.name ?? code };

  it("every Pick that asks a player says what the card is for", () => {
    const prompts: string[] = [];
    for (const effect of dolGuldur) {
      walk(effect.instructions, (instruction, next) => {
        if (instruction.verb !== "Pick") return;
        const words = pickWords(instruction, next, dolNames, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    // The Dungeon Jailor's objective, the hero that claims each objective (named by the objective card), the Nazgûl's character, Cavern Guardian's attachment.
    expect(prompts).toContain("Choose an unclaimed objective to shuffle into the encounter deck.");
    expect(prompts).toContain("Choose a hero to carry 01108. Attached hero cannot attack or defend.");
    expect(prompts).toContain("Choose a hero to carry 01109. Forced: At the end of each round, raise attached hero's controller's threat by 2.");
    expect(prompts).toContain("Choose a hero to carry 01110. Forced: At the end of each round, attached hero suffers 1 damage.");
    expect(prompts).toContain("Choose a character to discard.");
    expect(prompts).toContain("Choose an attachment to discard.");
  });

  it("a third Restricted attachment on a hero asks which one leaves, and says an objective returns to the staging area (rr.restricted)", () => {
    const words = pickWords({ verb: "DiscardRestricted" }, undefined, { card: () => "Aragorn", code: (code) => code }, "h1", 2);
    expect(words).toEqual({ verb: "Remove", prompt: "Aragorn can hold 2 Restricted attachments. Choose 1 to remove: an objective returns to the staging area, any other card is discarded." });
    expect(pickWords({ verb: "DiscardRestricted" }, undefined, { card: () => "Aragorn", code: (code) => code }, "h1", 3).prompt).toContain("can hold 3 Restricted");
  });

  it("every Choose names each branch in a sentence", () => {
    const made = dolGuldurTable(dolGuldurWorld);
    for (const effect of dolGuldur) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) expect(branchWords(instruction, option.id, made.state, dolNames, effect.cardCode), `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
      });
    }
  });

  it("the new verbs read as sentences when a record offers them in a choice", () => {
    const made = dolGuldurTable(dolGuldurWorld);
    type Branch = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"][number];
    const say = (instruction: Branch): string => branchWords({ verb: "Choose", who: "actor", options: [{ id: "x", instructions: [instruction] }] }, "x", made.state, dolNames, null);
    expect(say({ verb: "GuardObjective" })).toBe("Reveal the next encounter card that is not an objective and attach it to the objective");
    expect(say({ verb: "ClaimObjective" })).toBe("Claim this objective and attach it to the chosen hero");
    expect(say({ verb: "TakePrisoner" })).toBe("Turn a hero chosen at random facedown: it is the prisoner");
    expect(say({ verb: "SelectLoggedPrisoner" })).toBe("The prisoner the Campaign Log names is the prisoner instead");
    expect(say({ verb: "CaptureWithPrisoner", code: "01135" })).toBe("Capture Mendor facedown with the prisoner");
    expect(say({ verb: "RescuePrisoner", damage: 1 })).toBe("Rescue the prisoner: it comes back faceup with 1 damage on it");
    expect(say({ verb: "FreeCaptive", code: "01135", damage: 1 })).toBe("Free Mendor faceup with 1 damage on him");
    expect(say({ verb: "PlaceOrcGuard" })).toBe("Turn the top card of your deck into an Orc Guard engaged with you");
    expect(say({ verb: "AttachToDeck", who: "firstPlayer" })).toBe("Attach it to the top of the first player's deck");
    expect(say({ verb: "TurnFaceUp", code: "01102" })).toBe("Turn Nazgûl of Dol Guldur faceup, still out of play");
    expect(say({ verb: "RaiseStagingThreat", amount: { players: true }, until: "endOfPhase" })).toBe("Raise the total Threat in the staging area by X until the end of the phase");
    expect(say({ verb: "LimitPlays", cardType: "ally", max: 1 })).toBe("The players play at most 1 ally card each round");
  });
});

// Every record of The Oath (src/effects/authored/the-oath.ts) and its boons and burdens (pool/TDoM.ts).
// The pool records of The Oath's own boons and burdens (The Caves of Nibin-Dûm's 41042, 41048 and 41049 are read by that scenario's section below).
const oath: readonly Effect[] = [...OATH_EFFECTS, ...TDOM_RECORDS.filter((effect) => !["41042", "41048", "41049"].includes(effect.cardCode))];

describe("the words of The Oath choices", () => {
  const oathNames: ChoiceNames = { card: (id) => id, code: (code) => oathWorld.cards.get(code)?.name ?? code };


  it("every instruction that asks a player says what the card is for, in a sentence of its own", () => {
    const prompts: string[] = [];
    for (const effect of oath) {
      walk(effect.instructions, (instruction, next) => {
        if (!ASKING_VERBS.has(instruction.verb)) return;
        // Only a ReturnToStaging that lets the player choose an engaged enemy asks (the attacker goes back without a question). A choice with a single
        // possible answer is taken without asking; the words are still written.
        if (instruction.verb === "ReturnToStaging" && instruction.target.kind !== "engagedEnemies") return;
        const words = pickWords(instruction, next, oathNames, effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/^[A-Z].*\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    // Forest and Goblin searches, the Spider Den's Spider, the hero that carries Guilty Conscience, the cards the Fervor of Lore discards, the character
    // an exhaust, a damage, a discard and a heal fall on, the location that takes progress, the ally Abandoned Camp puts into play.
    expect(prompts).toContain("Choose a Forest location from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose a Goblin enemy from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose a Spider enemy from the encounter deck or discard pile to put into play engaged with you.");
    expect(prompts).toContain("Choose a hero to carry 41043.");
    expect(prompts).toContain("Choose 3 cards to discard from your hand, one at a time.");
    expect(prompts).toContain("Choose an enemy engaged with you to return to the staging area.");
    expect(prompts).toContain("Choose a hero to heal all damage from.");
    expect(prompts).toContain("Choose a location to place 3 progress on.");
    expect(prompts).toContain("Choose an ally to put into play.");
    expect(prompts).toContain("Choose a character to exhaust.");
    expect(prompts).toContain("Choose a questing character to discard.");
    expect(prompts).toContain("Choose a hero to ready.");
  });

  it("every Choose names each branch in a sentence (Eyes in the Dark)", () => {
    const made = oathTable(oathWorld);
    let branches = 0;
    for (const effect of oath) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          branches += 1;
          const words = branchWords(instruction, option.id, made.state, oathNames, effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id);
        }
      });
    }
    expect(branches).toBe(2);
    const eyes = oath.find((effect) => effect.id === "41025:whenRevealed:1");
    const choose = eyes?.instructions[0]?.verb === "ForEachPlayer" ? eyes.instructions[0].instructions[0] : undefined;
    if (choose?.verb !== "Choose") throw new Error("41025:whenRevealed:1 does not open with each player's Choose");
    expect(branchWords(choose, "discard", made.state, oathNames, "41025")).toBe("Choose a questing character, then discard it");
  });

  it("the new verbs read as sentences when a record offers them in a choice", () => {
    const made = oathTable(oathWorld);
    type Branch = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"][number];
    const say = (instruction: Branch): string => branchWords({ verb: "Choose", who: "actor", options: [{ id: "x", instructions: [instruction] }] }, "x", made.state, oathNames, null);
    expect(say({ verb: "SearchCollection", code: "41020", to: "staging" })).toBe("Search the encounter deck, the discard pile and your collection for Goblin Sniper and add it to the staging area");
    expect(say({ verb: "RaiseThreat", amount: { count: { type: "character", control: "you", committed: true } }, who: "actor" })).toBe("Raise your threat by 1 for each questing character you control");
    expect(say({ verb: "PlaceToken", amount: 1 })).toBe("Place 1 resource token on this card");
    expect(say({ verb: "SearchMove", trait: "Spider", type: "enemy", to: "engaged" })).toBe("Put a Spider enemy into play engaged with you");
    expect(say({ verb: "SearchMove", trait: "Forest", type: "location", to: "staging" })).toBe("Add a Forest location from the encounter deck or discard pile to the staging area");
  });
});

// Every record of The Caves of Nibin-Dûm (src/effects/authored/the-caves-of-nibin-dum.ts) and its boons and burden (pool/TDoM.ts: 41042, 41048, 41049).
const caves: readonly Effect[] = [...CAVES_EFFECTS, ...TDOM_RECORDS.filter((effect) => ["41042", "41048", "41049"].includes(effect.cardCode))];

describe("the words of The Caves of Nibin-Dûm choices", () => {
  let cavesWorld: CavesWorld;
  beforeAll(async () => {
    cavesWorld = await loadCavesWorld();
  });
  const cavesNames = (): ChoiceNames => ({ card: (id) => id, code: (code) => cavesWorld.cards.get(code)?.name ?? code });
  const ASKING = new Set([...ASKING_VERBS, "PickEncounter", "ChooseX"]);

  it("every instruction that asks a player says what the card is for, in a sentence of its own", () => {
    const prompts: string[] = [];
    for (const effect of caves) {
      walk(effect.instructions, (instruction, next) => {
        if (!ASKING.has(instruction.verb)) return;
        // Only a ReturnToStaging that lets the player choose an engaged enemy asks.
        if (instruction.verb === "ReturnToStaging" && instruction.target.kind !== "engagedEnemies") return;
        const words = pickWords(instruction, next, cavesNames(), effect.cardCode);
        expect(words.prompt, effect.id).toMatch(/^[A-Z].*\.$/);
        expect(words.prompt, effect.id).not.toMatch(/^Choose an? \w+\.$/);
        expect(words.prompt, effect.id).not.toBe("Choose one.");
        expect(words.verb, effect.id).not.toBe("Choose");
        prompts.push(words.prompt);
      });
    }
    expect(prompts).toContain("Choose a hero to carry Cave Torch.");
    expect(prompts).toContain("Choose a location from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose an enemy from the encounter deck or discard pile to add to the staging area.");
    expect(prompts).toContain("Choose X, from 1 to 3.");
    expect(prompts).toContain("Choose a Dark location to place X progress on.");
    expect(prompts).toContain("Choose an ally to put into play.");
    expect(prompts).toContain("Choose a character to exhaust.");
    expect(prompts).toContain("Choose the card to reveal: the other cards you looked at go to the bottom of the encounter deck.");
    expect(prompts).toContain("Choose a card to put into your hand.");
  });

  it("says a hero is chosen to attach Watchful Eyes to, not to carry it (41040:A:1)", () => {
    const record = CAVES_EFFECTS.find((effect) => effect.id === "41040:whenRevealed:1")?.instructions[0];
    if (!record) throw new Error("no Watchful Eyes record");
    const named: ChoiceNames = { card: (id) => (id === "eyes" ? "Watchful Eyes" : id), code: cavesNames().code };
    expect(pickWords(record, undefined, named, "eyes").prompt).toBe("Choose a hero to attach Watchful Eyes to.");
    expect(pickWords(record, undefined, named, "other").prompt).toBe("Choose a hero to carry other.");
  });

  it("every Choose names each branch in a sentence", () => {
    const made = cavesTable(cavesWorld);
    const seen: Record<string, string> = {};
    for (const effect of caves) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, made.state, cavesNames(), effect.cardCode);
          expect(words, `${effect.id} ${option.id}`).toMatch(/^[A-Z].+/);
          expect(words, `${effect.id} ${option.id}`).not.toBe(option.id);
          seen[`${effect.id} ${option.id}`] = words;
        }
      });
    }
    expect(seen["41027:forced:1 progress"]).toBe(`Remove ${stageNumber(made.state)} progress from the quest`);
    const stage2 = cavesTable(cavesWorld, { stage: "41005" });
    const chieftain = CAVES_EFFECTS.find((effect) => effect.id === "41027:forced:1")?.instructions[0];
    if (chieftain?.verb !== "Choose") throw new Error("the Chieftain's record is not a choice");
    expect(branchWords(chieftain, "progress", stage2.state, cavesNames(), "41027")).toBe("Remove 2 progress from the quest");
    expect(seen["41027:forced:1 staging"]).toBe("Return it to the staging area");
    expect(seen["41039:whenRevealed:1 exhaust"]).toBe("Exhaust Cave Torch");
    expect(seen["41039:whenRevealed:1 noProgress"]).toBe("No progress can be placed on the quest until the end of the phase");
    expect(seen["41042:whenRevealed:1 add"]).toBe("Each hero you control gains 1 resource, then raise your threat by 5");
    expect(seen["41042:whenRevealed:1 decline"]).toBe("Do nothing");
    expect(seen["41025:whenRevealed:1 discard"]).toBeUndefined();
  });

  it("names the two Actions of \"No Time to Waste!\" and Ranger Sense when the player chooses one (41048:A:1, 41049:A:1)", () => {
    const made = cavesTable(cavesWorld);
    const sayAll = (code: string) => {
      const running = caves.filter((effect) => effect.cardCode === code && effect.timing === "action");
      const choice = alternativeActions(running);
      if (choice?.[0]?.verb !== "Choose") throw new Error(`${code} does not offer a choice of Actions`);
      return running.map((effect) => branchWords(choice[0] as Extract<Instruction, { verb: "Choose" }>, effect.id, made.state, cavesNames(), null));
    };
    expect(sayAll("41048")).toEqual([
      "Each player lowers threat by 3 and an encounter card is revealed. This card leaves the game and the Campaign Pool.",
      "Draw 1 card",
    ]);
    expect(sayAll("41049")).toEqual([
      "Look at the top 4 cards of your deck and put 1 into your hand. This card leaves the game and the Campaign Pool.",
      "Draw 1 card",
    ]);
  });

  it("shows the Cave Torch's X as the progress it places, with the caves prompt as the note (41029:A:2)", () => {
    const made = cavesTable(cavesWorld, { attachments: ["41029"], staging: ["41032"] });
    const offer = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && made.state.cards[intent.cardId]?.code === "41029");
    if (offer?.type !== "Trigger") throw new Error("the Cave Torch is not offered");
    const run = send(start(made.state), offer, made.ctx);
    const names: SheetNames = { card: (id) => cavesWorld.cards.get(run.state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const sheet = sheetFor(run.state, made.ctx, legalIntents(run.state, made.ctx), names);
    if (sheet?.kind !== "pick") throw new Error(`the Torch's X is not a pick sheet: ${sheet?.kind}`);
    expect(sheet.note).toContain("Choose how much progress to place on a Dark location.");
    expect(sheet.note).not.toContain("Choose one.");
    expect(sheet.options.map((option) => option.label)).toEqual(["Place 1 progress", "Place 2 progress", "Place 3 progress"]);
    expect(first(run.state, "41029")).toBeDefined();
  });
});

describe("a Pick followed by PlaceFacedownUnder (144036:A:2, 144038:A:2)", () => {
  it("says what the card is for and names the host", () => {
    const names: ChoiceNames = { card: (id) => id, code: (code) => (code === "144027" ? "The Black Gate" : code) };
    const pick: Instruction = { verb: "Pick", pick: { type: "enemy", control: "any", trait: "Harad", engaged: "you" } };
    expect(pickWords(pick, { verb: "PlaceFacedownUnder", code: "144027", target: "picked" }, names, "144036")).toEqual({ verb: "Place", prompt: "Choose an enemy to place facedown under The Black Gate." });
  });
});

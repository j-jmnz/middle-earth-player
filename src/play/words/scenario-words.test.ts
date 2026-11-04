// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The words of every choice a scenario's cards can open, before its golden is pinned: every record of
// every card the scenario deals (dealtCodes, the cards its campaign places and the player pool included) has its Pick and Choose worded as a sentence that names the number,
// the side and whose deck (docs/design-system-table.md, Choice tray). `pickWords` is built with no game and `branchWords` with a skeleton table (blankScenario). The test fails on
// a bare "Choose a player." and on a fallback sentence: one equal to what the same function returns for a verb or an option it does not know.
// `WORDS_DUMP=<scenario-id>` (or `all`) prints every sentence; `pnpm test:scenario <scenario-id> --words` runs only this file with it set.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { EFFECTS } from "../../effects/index.ts";
import { blankScenario } from "../../rules/core/state.ts";
import { loadCards } from "../../../scripts/data/load-cards.ts";
import { dealtCodes, loadCampaigns, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { ROOT } from "../../../scripts/data/paths.ts";
import { ASKING_VERBS, walk } from "../../../test/harness/record-walk.ts";
import { WORDS_SCENARIOS } from "../../../test/harness/words-scenarios.ts";

import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";

// The instructions that ask for something besides a Pick of a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
const ASKING = new Set([...ASKING_VERBS, "PickEncounter", "ChooseX", "Reattach", "PlayFromHand", "PayToPlay", "SpendResources", "ChooseAmount", "DiscardRestricted", "AssignDamage"]);

// A sentence that is allowed to equal the fallback, by `<record id> <pick | option id>`. Each entry says why it is fine.
const ACTIVE = "Picks the active location, a single card unless a second location is active, so the question is rarely asked; the prompt says which kind of card.";
const ALLOWED: Readonly<Record<string, string>> = {
  "141070:whenRevealed:1 AttachSelf": "Open: the Nazgul it attaches to; the prompt should name the card and the enemy.",
  "141074:whenRevealed:1 AttachSelf": "Open: the Nazgul it attaches to; the prompt should name the card and the enemy.",
  "142021:forced:1 Pick": ACTIVE,
  "142022:forced:2 Pick": ACTIVE,
  "142027:forced:1 Pick": ACTIVE,
  "142027:shadow:1 Pick": ACTIVE,
  "906403:forced:1 Pick": ACTIVE,
  "906404:shadow:1 Pick": ACTIVE,
  "906404:whenRevealed:1 Pick": ACTIVE,
  "142043:forced:2 Pick": "Open: the Balrog, a named unique staging enemy (stagingOnly); the sentence is unchanged from before section 2 and says only \"an enemy\".",
  "142059:whenRevealed:1 Pick": "Open: the Balrog, a named unique staging enemy (stagingOnly); the sentence is unchanged from before section 2 and says only \"an enemy\".",
  "142064:response:1 Pick": "Open: the player whose heroes ready; the prompt should name the ready, as 142065's names the draw and the threat.",
  "142079:travel:1 Pick": "Open: the staging enemy a player engages; the prompt should say it engages the player.",
  "900303:shadow:1 Pick": "Open: the attacking staging enemy whose delayed threat is raised; the prompt should say what the enemy is picked for.",
};

const bare = /^Choose an? [\w-]+\.$/;
const cards = new Map(loadCards().map((card) => [card.code, card]));
const campaigns = loadCampaigns();
const dump = process.env.WORDS_DUMP;

describe.each(WORDS_SCENARIOS)("the words of %s", (id) => {
  const scenario = loadScenario(id);
  const codes = dealtCodes(campaigns, [scenario], { nightmare: true });
  const records = EFFECTS.filter((effect) => codes.has(effect.cardCode));
  const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
  const lines: string[] = [];
  const problems: string[] = [];

  afterAll(() => {
    if (dump === id || dump === "all") process.stdout.write(`\n${id}\n${[...new Set(lines)].join("\n")}\n`);
  });

  it("names the number, the side and whose deck in every pick", () => {
    problems.length = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next, after) => {
        if (!ASKING.has(instruction.verb)) return;
        // Only a ReturnToStaging that lets the player choose an engaged enemy asks; the others send a known card back without a question.
        if (instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose")) return;
        const words = pickWords(instruction, next, names, effect.cardCode, 2, undefined, undefined, after);
        // What the same function says for a Pick with no instruction after it, or for a verb it has no words for.
        const fallback = pickWords(instruction.verb === "Pick" ? instruction : ({ verb: "NoSuchVerb" } as unknown as Instruction), undefined, names, null);
        const key = `${effect.id} ${instruction.verb}`;
        lines.push(`${key}: ${words.verb} / ${words.prompt}`);
        if (ALLOWED[key] !== undefined) return;
        if (!/^[A-Z].*\.$/.test(words.prompt)) problems.push(`${key}: not a sentence: ${words.prompt}`);
        else if (bare.test(words.prompt)) problems.push(`${key}: a bare "${words.prompt}"`);
        else if (words.prompt === fallback.prompt) problems.push(`${key}: the fallback sentence "${words.prompt}"`);
      });
    }
    expect(problems).toEqual([]);
  });

  it("names every branch of every Choose in a sentence of its own", () => {
    problems.length = 0;
    const campaign = campaigns.find((one) => one.scenarios.includes(id)) ?? campaigns[0]!;
    const definition = scenarioDefinition(scenario, campaign, EFFECTS);
    const state = blankScenario({ seatCount: 2, seed: 1, definition });
    for (const effect of records) {
      walk(effect.instructions, (instruction) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, state, names, effect.cardCode);
          const key = `${effect.id} ${option.id}`;
          lines.push(`${key}: ${words}`);
          if (ALLOWED[key] !== undefined) continue;
          // branchWords answers an option it has no words for with the option's id, capitalised.
          if (words === option.id.charAt(0).toUpperCase() + option.id.slice(1)) problems.push(`${key}: the fallback sentence "${words}"`);
          else if (!/^[A-Z0-9]/.test(words)) problems.push(`${key}: not a sentence: ${words}`);
        }
      });
    }
    expect(problems).toEqual([]);
  });
});

// The sentences that named no card, side or number before (docs/design-system-table.md, Choice tray), pinned.
describe("the sentences the check once caught", () => {
  const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
  const asked = (id: string, verb?: string): { pick: Instruction; next: Instruction | undefined; after: readonly Instruction[] } => {
    const found: { pick: Instruction; next: Instruction | undefined; after: readonly Instruction[] }[] = [];
    walk(EFFECTS.find((effect) => effect.id === id)!.instructions, (instruction, next, after) => {
      if (verb ? instruction.verb === verb : ASKING.has(instruction.verb)) found.push({ pick: instruction, next, after });
    });
    return found[0]!;
  };
  const words = (id: string, code: string, verb?: string) => {
    const { pick, next, after } = asked(id, verb);
    return pickWords(pick, next, names, code, 2, undefined, undefined, after).prompt;
  };

  it("names The Thing in the Depths where Lashing Tentacles asks for an enemy (12056)", () => {
    expect(words("12056:whenRevealed:1", "12056")).toBe("Choose The Thing in the Depths to attack from the staging area.");
    expect(words("12056:shadow:1", "12056")).toBe("Choose The Thing in the Depths to attack from the staging area.");
  });

  it("names the card that moves when an attachment is attached to another card (the Reattach Action and Command)", () => {
    expect(words("02002:action:1", "02002")).toBe(`Choose another hero to attach ${names.code("02002")} to.`);
    expect(words("11204:action:1", "11204", "Reattach")).toBe("Choose another card to attach it to.");
  });

  it("names Corsair Skirmisher and Taking on Water in the sentences that said this card (12125, 12132)", () => {
    expect(words("12125:response:1", "12125")).toContain("to take control of Corsair Skirmisher as a Ship objective.");
    expect(words("12132:whenRevealed:1", "12132")).toBe("Choose the Ship objective Taking on Water attaches to.");
  });
});

// Words are a function of the instruction, the names and the table they are handed: no module state, no store read (docs/design-system-table.md, Choice tray).
describe("the words code", () => {
  it("reads no module state", () => {
    const dir = path.join(ROOT, "src/play/words");
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, file).not.toMatch(/^(let|var) /m);
      expect(source, file).not.toMatch(/getState\(|WeakMap|memoOf/);
    }
  });
});

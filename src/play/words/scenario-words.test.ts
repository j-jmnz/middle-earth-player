// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The words of every choice a scenario's cards can open, before its golden is pinned: every record of
// every card the scenario deals (dealtCodes, the cards its campaign places and the player pool included) has its Pick and Choose worded as a sentence that names the number,
// the side and whose deck (docs/design-system-table.md, Choice tray). A pick is worded by `askWords`, the function the sheet calls (grapple and sea questions before `pickWords`), and `branchWords` by the same skeleton table (blankScenario). The test fails on
// a bare "Choose a player." and on a fallback sentence: one equal to what the same function returns for a verb or an option it does not know.
// `WORDS_DUMP=<scenario-id>` (or `all`) prints every sentence; `pnpm test:scenario <scenario-id> --words` runs only this file with it set.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { EFFECTS } from "../../effects/index.ts";
import { blankScenario } from "../../rules/core/state.ts";
import { loadCards } from "../../../scripts/data/load-cards.ts";
import { dealtCodes, loadCampaigns, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { ROOT } from "../../../scripts/data/paths.ts";
import { ASKING_VERBS, walk } from "../../../test/harness/record-walk.ts";
import { WORDS_SCENARIOS } from "../../../test/harness/words-scenarios.ts";

import { askWords } from "./ask.ts";
import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";

// The instructions that ask for something besides a Pick of a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
const ASKING = new Set([...ASKING_VERBS, "PickEncounter", "ChooseX", "Reattach", "PlayFromHand", "PayToPlay", "SpendResources", "ChooseAmount", "DiscardRestricted", "AssignDamage"]);

// A sentence that is allowed to equal the fallback or to be a bare prompt, by `<record id> @<the instruction's path in the record> <verb | option id>`
// (test/harness/record-walk.ts). Each entry says why it is fine, and the test fails on an entry no sentence needs any more.
const OPEN_ACTIVE = "Open: picks the active location, a single card unless a second location is active; the prompt should say what the location is picked for.";
const OPEN_BALROG = "Open: the Balrog, a named unique staging enemy (stagingOnly); the prompt says only \"an enemy\".";
const ALLOWED: Readonly<Record<string, string>> = {
  "141070:whenRevealed:1 @0 AttachSelf": "Open: the Nazgul it attaches to; the prompt should name the card and the enemy.",
  "141074:whenRevealed:1 @0 AttachSelf": "Open: the Nazgul it attaches to; the prompt should name the card and the enemy.",
  "142021:forced:1 @0 Pick": OPEN_ACTIVE,
  "142022:forced:2 @0 Pick": OPEN_ACTIVE,
  "142027:forced:1 @0 Pick": OPEN_ACTIVE,
  "142027:shadow:1 @1.0 Pick": OPEN_ACTIVE,
  "906403:forced:1 @0.damage.0 Pick": OPEN_ACTIVE,
  "906404:shadow:1 @0.0 Pick": OPEN_ACTIVE,
  "906404:whenRevealed:1 @1.0 Pick": OPEN_ACTIVE,
  "906404:whenRevealed:1 @1.2 Pick": OPEN_ACTIVE,
  "142043:forced:2 @0 Pick": OPEN_BALROG,
  "142059:whenRevealed:1 @0.balrog.0 Pick": OPEN_BALROG,
  "142064:response:1 @0 Pick": "Open: the player whose heroes ready; the prompt should name the ready, as 142065's names the draw and the threat.",
  "142079:travel:1 @0 Pick": "Open: the staging enemy a player engages; the prompt should say it engages the player.",
  "900303:shadow:1 @0 Pick": "Open: the attacking staging enemy whose delayed threat is raised; the prompt should say what the enemy is picked for.",
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
  const campaign = campaigns.find((one) => one.scenarios.includes(id)) ?? campaigns[0]!;
  const game = blankScenario({ seatCount: 2, seed: 1, definition: scenarioDefinition(scenario, campaign, EFFECTS) });
  const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
  const lines: string[] = [];
  const problems: string[] = [];
  // The allowlist keys a sentence needed, over both tests.
  const needed = new Set<string>();

  afterAll(() => {
    if (dump === id || dump === "all") process.stdout.write(`\n${id}\n${[...new Set(lines)].join("\n")}\n`);
  });

  const judge = (key: string, problem: string | null): void => {
    if (problem === null) return;
    needed.add(key);
    if (ALLOWED[key] === undefined) problems.push(`${key}: ${problem}`);
  };

  it("names the number, the side and whose deck in every pick", () => {
    problems.length = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, next, after, path) => {
        if (!ASKING.has(instruction.verb)) return;
        // Only a ReturnToStaging that lets the player choose an engaged enemy asks; the others send a known card back without a question.
        if (instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose")) return;
        const words = askWords({ game, ctx, names, instruction, queue: next ? [next, ...after] : [], options: [], source: effect.cardCode, picked: null });
        // What the same function says for a Pick with no instruction after it, or for a verb it has no words for.
        const fallback = pickWords(instruction.verb === "Pick" ? instruction : ({ verb: "NoSuchVerb" } as unknown as Instruction), undefined, names, null);
        const key = `${effect.id} @${path} ${instruction.verb}`;
        lines.push(`${key}: ${words.verb} / ${words.prompt}`);
        judge(key, !/^[A-Z].*\.$/.test(words.prompt) ? `not a sentence: ${words.prompt}` : bare.test(words.prompt) ? `a bare "${words.prompt}"` : words.prompt === fallback.prompt ? `the fallback sentence "${words.prompt}"` : null);
      });
    }
    expect(problems).toEqual([]);
  });

  it("names every branch of every Choose in a sentence of its own", () => {
    problems.length = 0;
    for (const effect of records) {
      walk(effect.instructions, (instruction, _next, _after, path) => {
        if (instruction.verb !== "Choose") return;
        for (const option of instruction.options) {
          const words = branchWords(instruction, option.id, game, names, effect.cardCode);
          const key = `${effect.id} @${path} ${option.id}`;
          lines.push(`${key}: ${words}`);
          // branchWords answers an option it has no words for with the option's id, capitalised.
          judge(key, words === option.id.charAt(0).toUpperCase() + option.id.slice(1) ? `the fallback sentence "${words}"` : !/^[A-Z0-9]/.test(words) ? `not a sentence: ${words}` : null);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  // An entry of a card this scenario deals that no sentence needs any more is removed, so the list holds only what is still open.
  it("keeps no allowlist entry that no sentence needs", () => {
    const stale = Object.keys(ALLOWED).filter((key) => codes.has(key.split(":")[0] ?? "") && !needed.has(key));
    expect(stale).toEqual([]);
  });
});

// Sentences that name the card they are about, pinned as the sheet words them (askWords, on a skeleton table).
describe("pinned sentences", () => {
  const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
  const scenario = loadScenario("a-storm-on-cobas-haven");
  const campaign = campaigns.find((one) => one.scenarios.includes("a-storm-on-cobas-haven")) ?? campaigns[0]!;
  const game = blankScenario({ seatCount: 2, seed: 1, definition: scenarioDefinition(scenario, campaign, EFFECTS) });
  const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
  const asked = (id: string, verb?: string): { pick: Instruction; next: Instruction | undefined; after: readonly Instruction[] } => {
    const found: { pick: Instruction; next: Instruction | undefined; after: readonly Instruction[] }[] = [];
    walk(EFFECTS.find((effect) => effect.id === id)!.instructions, (instruction, next, after) => {
      if (verb ? instruction.verb === verb : ASKING.has(instruction.verb)) found.push({ pick: instruction, next, after });
    });
    return found[0]!;
  };
  const words = (id: string, code: string, verb?: string) => {
    const { pick, next, after } = asked(id, verb);
    return askWords({ game, ctx, names, instruction: pick, queue: next ? [next, ...after] : [], options: [], source: code, picked: null }).prompt;
  };

  it("names The Thing in the Depths where Lashing Tentacles asks for an enemy (12056)", () => {
    expect(words("12056:whenRevealed:1", "12056")).toBe("Choose The Thing in the Depths to attack from the staging area.");
    expect(words("12056:shadow:1", "12056")).toBe("Choose The Thing in the Depths to attack from the staging area.");
    const { pick, next } = asked("12056:whenRevealed:1");
    expect(pickWords(pick, next, names, "12056").verb).toBe("Choose");
  });

  it("names the card that moves when an attachment is attached to another card (the Reattach Action and Command)", () => {
    expect(words("02002:action:1", "02002")).toBe(`Choose another hero to attach ${names.code("02002")} to.`);
    expect(words("11204:action:1", "11204", "Reattach")).toBe("Choose another eligible character to move it to.");
  });

  it("names Corsair Skirmisher and Taking on Water in the sentences that said this card (12125, 12132)", () => {
    expect(words("12125:response:1", "12125")).toBe("Corsair Skirmisher: choose an ally to discard. At least 3 Willpower is needed to take control of it as a Ship objective.");
    expect(words("12132:whenRevealed:1", "12132")).toBe("Choose the Ship objective to attach Taking on Water to.");
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

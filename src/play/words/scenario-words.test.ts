// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The words of every choice a scenario's cards can open, before its golden is pinned: every record of
// every card the scenario deals (dealtCodes, the cards its campaign places and the player pool included) has its Pick and Choose worded as a sentence that names the number,
// the side and whose deck (docs/design-system-table.md, Choice tray). A pick is worded by `askWords`, the function the sheet calls (grapple and sea questions before `pickWords`), and `branchWords` by the same skeleton table (blankScenario). The test fails on
// a bare "Choose a player." and on a fallback sentence: one equal to what the same function returns for a verb or an option it does not know.
// `WORDS_DUMP=<scenario-id>` (or `all`) prints every sentence; `pnpm test scenario <scenario-id> --words` runs only this file with it set.
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
import { asksPlayer, walk } from "../../../test/harness/record-walk.ts";
import { judgeBranch, judgePick } from "../../../test/harness/words-judge.ts";
import { WORDS_SCENARIOS } from "../../../test/harness/words-scenarios.ts";

import { askWords } from "./ask.ts";
import { pickWords, type ChoiceNames } from "./choice.ts";

// The judgement of a Pick and of a branch is test/harness/words-judge.ts's (the record's asks entry first, then the chain), the one asks.test.ts uses for a scenario worded by an asks file.
const asks = asksPlayer;

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
        const verdict = judgePick({ game, ctx, names }, effect, instruction, next, after, path);
        if (!verdict) return;
        lines.push(verdict.line);
        judge(verdict.key, verdict.problem);
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
          const verdict = judgeBranch({ game, ctx, names }, effect, instruction, option.id, path);
          lines.push(verdict.line);
          judge(verdict.key, verdict.problem);
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
  const asked = (id: string, verb?: string, nth = 0): { pick: Instruction; next: Instruction | undefined; after: readonly Instruction[] } => {
    const found: { pick: Instruction; next: Instruction | undefined; after: readonly Instruction[] }[] = [];
    walk(EFFECTS.find((effect) => effect.id === id)!.instructions, (instruction, next, after) => {
      if (verb ? instruction.verb === verb : asks(instruction)) found.push({ pick: instruction, next, after });
    });
    return found[nth]!;
  };
  const words = (id: string, code: string, verb?: string, nth = 0) => {
    const { pick, next, after } = asked(id, verb, nth);
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

  it("says who gives and who gets in The City of Corsairs' resource moves (12162, 12154, 12156, 11215)", () => {
    expect(words("12162:shadow:1", "12162")).toBe("Umbar Harbor: choose a hero you control to give 1 resource to the attacking Raider.");
    expect(words("12162:shadow:1", "12162", undefined, 1)).toBe("Umbar Harbor: the attacking enemy gets 1 resource.");
    expect(words("12154:travel:1", "12154")).toBe("Southern Belfalas: choose the player who reveals the top card of the Corsair deck and engages it.");
    expect(words("12156:shadow:1", "12156")).toBe("Watch Tower: choose a Raider enemy to get resources equal to the printed cost of the ally destroyed.");
    expect(words("11215:action:1", "11215", undefined, 1)).toBe("Choose a hero you control to exhaust and take 1 resource from The Black Sword.");
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

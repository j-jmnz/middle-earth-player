// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The asks files (src/play/words/asks/<scenario-id>.ts, read by asks.ts): templates, bindings, cautions, the lookup by record and path, the
// barrel pnpm data:build writes, and the checks a scenario with an asks file passes: every Pick and Choose is worded, every key names a record path, every template fills. `WORDS_DUMP=<scenario-id>` (or `all`) prints each sentence.
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { EFFECTS } from "../../effects/index.ts";
import { blankScenario } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { loadCards } from "../../../scripts/data/load-cards.ts";
import { dealtCodes, loadCampaigns, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { ROOT } from "../../../scripts/data/paths.ts";
import { asksFileNames, checkAsksNames, renderAsksBarrel } from "../../../scripts/data/effects/asks-barrel.ts";
import { ASKING_VERBS, walk } from "../../../test/harness/record-walk.ts";

import { askWords } from "./ask.ts";
import { askKey, asksChoose, asksOption, asksPick, fill, placeholdersOf, unknownPlaceholders, type Ask, type AsksTable } from "./asks.ts";
import { ASKS_BY_SCENARIO } from "./asks/index.ts";
import { branchWords, pickWords, type ChoiceNames } from "./choice.ts";
import { pathOf } from "./record-path.ts";

const cards = new Map(loadCards().map((card) => [card.code, card]));
const campaigns = loadCampaigns();
const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
const tableOf = (id: string, seatCount: 1 | 2 = 2) => {
  const scenario = loadScenario(id);
  const campaign = campaigns.find((one) => one.scenarios.includes(id)) ?? campaigns[0]!;
  return blankScenario({ seatCount, seed: 1, definition: scenarioDefinition(scenario, campaign, EFFECTS) });
};

// Urdug's Elite (19158:A:1): a Choose at path 0 whose "exhaust" branch picks a ready character at 0.exhaust.0.
const RECORD = "19158:forced:1";
const record = EFFECTS.find((effect) => effect.id === RECORD)!;
const choose = record.instructions[0] as Extract<Instruction, { verb: "Choose" }>;
const pick = (choose.options.find((option) => option.id === "exhaust")?.instructions[0])!;
const facts = (instruction: Instruction, seatCount: 1 | 2 = 2) => ({ game: tableOf("the-fate-of-wilderland", seatCount), ctx, names, instruction, source: "19158" });

const NOTE: Ask = {
  note: "The Goblins' Assault: {held} of {need} progress. At {need} the quest moves on.",
  why: "it engaged you.",
  owned: true,
  bind: { held: 3, need: { players: true, times: 2, plus: 2 } },
};
const table: AsksTable = {
  [askKey(RECORD, "0", "Choose")]: NOTE,
  [askKey(RECORD, "0", "exhaust")]: { label: "Exhaust a character you control" },
  [askKey(RECORD, "0", "progress")]: { label: "Place {n} progress", bind: { n: { players: true } }, caution: { when: { kind: "less", left: 0, right: { players: true } }, text: "Tap again: {n} progress on {card}" } },
  [askKey(RECORD, "0.exhaust.0", "Pick")]: { verb: "Exhaust", note: "{card}: choose a ready character you control to exhaust.", owned: true, labels: { skip: "Exhaust no one ({owner})" }, caution: { when: { kind: "less", left: 5, right: 1 }, text: "never" } },
};

describe("an asks entry", () => {
  it("says the card, the reason the window opened and the numbers the table holds, led by the player two-handed", () => {
    expect(asksChoose(facts(choose), table)).toEqual({ note: "Player 1, Urdug's Elite: it engaged you. The Goblins' Assault: 3 of 6 progress. At 6 the quest moves on.", owned: true });
  });

  it("has no lead solo, and the sheet then adds none either", () => {
    expect(asksChoose(facts(choose, 1), table)).toEqual({ note: "Urdug's Elite: it engaged you. The Goblins' Assault: 3 of 4 progress. At 4 the quest moves on.", owned: false });
  });

  it("leaves the note to the sheet's lead when it is not owned", () => {
    const loose: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: "{card} was explored." } };
    expect(asksChoose(facts(choose), loose)).toEqual({ note: "Urdug's Elite was explored.", owned: false });
  });

  it("words a branch: its row from the entry keyed with the option id, and its caution only when the condition holds", () => {
    expect(asksOption(facts(choose), "exhaust", table)).toEqual({ label: "Exhaust a character you control" });
    expect(asksOption(facts(choose), "progress", table)).toEqual({ label: "Place 2 progress", caution: "Tap again: 2 progress on Urdug's Elite" });
    // 0 < players is true with one player, so the caution holds there too; with the condition reversed it does not.
    const never: AsksTable = { [askKey(RECORD, "0", "progress")]: { label: "Place 1", caution: { when: { kind: "less", left: { players: true }, right: 0 }, text: "no" } } };
    expect(asksOption(facts(choose), "progress", never)).toEqual({ label: "Place 1" });
  });

  it("words a Pick: the verb, the sentence, the rows that are no card, and no caution while its condition fails", () => {
    expect(asksPick(facts(pick), table)).toEqual({ verb: "Exhaust", prompt: "Player 1, Urdug's Elite: choose a ready character you control to exhaust.", owned: true, labels: { skip: "Exhaust no one (Player 1)" } });
  });

  it("is keyed by the record and the path: another record or another instruction gets no entry, and a missing entry returns undefined for the chain", () => {
    const other = EFFECTS.find((effect) => effect.id === "19164:whenRevealed:1")!.instructions[0]!;
    expect(asksChoose({ ...facts(other), source: "19164" }, table)).toBeUndefined();
    expect(asksChoose(facts(choose), {})).toBeUndefined();
    expect(asksPick(facts(pick), {})).toBeUndefined();
    expect(asksOption(facts(choose), "exhaust", {})).toBeUndefined();
    // The Pick has no entry keyed "Choose", and the Choose none keyed "Pick".
    expect(asksPick(facts(choose), table)).toBeUndefined();
  });

  it("finds the record by the frame's effect id or the queued instruction's cause, and the path by walking the record", () => {
    const moved = { ...facts(choose), source: null };
    expect(asksChoose(moved, table)).toBeUndefined();
    expect(asksChoose({ ...moved, effectId: RECORD }, table)?.owned).toBe(true);
    expect(asksChoose({ ...moved, effectId: "someone-else", cause: { effect: RECORD, line: "19158:A:1" } }, table)?.owned).toBe(true);
    expect(pathOf(record.instructions, pick)).toBe("0.exhaust.0");
    // A copy the engine made of an instruction is found by what it says.
    expect(pathOf(record.instructions, { ...pick })).toBe("0.exhaust.0");
  });

  it("is never shown half filled: a placeholder with no value drops the entry, and the static check names it", () => {
    const broken: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: "{card}: {missing} of {n}." } };
    expect(asksChoose(facts(choose), broken)).toBeUndefined();
    expect(unknownPlaceholders({ note: "{card}: {missing} of {n}", label: "{other}", bind: { held: 1 } })).toEqual(["missing", "other"]);
    expect(placeholdersOf("{a} and {b_1}")).toEqual(["a", "b_1"]);
    expect(fill("{a}-{b}", { a: 1 })).toBeNull();
    expect(fill("{a}-{b}", { a: 1, b: "x" })).toBe("1-x");
  });

  it("is read first by askWords, and with no entry askWords answers as pickWords does", () => {
    const game = tableOf("the-fate-of-wilderland");
    const ask = { game, ctx, names, instruction: pick, queue: [], options: [], source: "19158", picked: null };
    expect(askWords(ask)).toEqual(pickWords(pick, undefined, names, "19158", 2, game, undefined, []));
  });
});

describe("the barrel of asks files", () => {
  it("is the one pnpm data:build writes (src/play/words/asks/index.ts)", () => {
    const dir = path.join(ROOT, "src", "play", "words", "asks");
    expect(readFileSync(path.join(dir, "index.ts"), "utf8"), "run pnpm data:build").toBe(renderAsksBarrel(asksFileNames(dir)));
  });

  it("imports each file under an upper-case name and merges them in order", () => {
    const barrel = renderAsksBarrel(["a-b", "c"]);
    expect(barrel).toContain(`import { ASKS as A_B } from "./a-b.ts";`);
    expect(barrel).toContain(`export const ASKS_BY_SCENARIO: Readonly<Record<string, Readonly<Record<string, Ask>>>> = { "a-b": A_B, "c": C };`);
    expect(barrel).toContain(`export const ASKS: Readonly<Record<string, Ask>> = { ...A_B, ...C };`);
  });

  it("names only scenarios of data/", () => {
    expect(() => checkAsksNames(["the-fate-of-wilderland"], [{ id: "the-fate-of-wilderland" }])).not.toThrow();
    expect(() => checkAsksNames(["no-such"], [{ id: "the-fate-of-wilderland" }])).toThrow(/named for no scenario/);
  });
});

// A scenario with an asks file is on the fast track: its words are data, and these checks stand in for the words code it has none of.
const dump = process.env.WORDS_DUMP;
const BARE = /^Choose an? [\w-]+\.$/;
describe.each(Object.keys(ASKS_BY_SCENARIO))("the asks of %s", (id) => {
  const asks = ASKS_BY_SCENARIO[id]!;
  const scenario = loadScenario(id);
  const codes = dealtCodes(campaigns, [scenario], { nightmare: true });
  const records = EFFECTS.filter((effect) => codes.has(effect.cardCode));
  const game = tableOf(id);
  const lines: string[] = [];
  afterAll(() => {
    if (dump === id || dump === "all") process.stdout.write(`\n${id}\n${lines.join("\n")}\n`);
  });

  it("words every Pick and Choose with an entry, or with words that are neither bare nor the fallback", () => {
    const problems: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction, next, after, at) => {
        if (instruction.verb === "Choose") {
          if (asks[askKey(effect.id, at, "Choose")] === undefined) problems.push(`${effect.id} @${at} Choose: no note entry`);
          for (const option of instruction.options) {
            const row = branchWords(instruction, option.id, game, names, effect.cardCode);
            if (asks[askKey(effect.id, at, option.id)]?.label === undefined && row === option.id.charAt(0).toUpperCase() + option.id.slice(1)) problems.push(`${effect.id} @${at} ${option.id}: no label entry and no words`);
          }
        } else if (ASKING_VERBS.has(instruction.verb) && !(instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose"))) {
          if (asks[askKey(effect.id, at, instruction.verb)] !== undefined) return;
          const words = askWords({ game, ctx, names, instruction, queue: next ? [next, ...after] : [], options: [], source: effect.cardCode, picked: null, effectId: effect.id });
          const fallback = pickWords(instruction.verb === "Pick" ? instruction : ({ verb: "NoSuchVerb" } as unknown as Instruction), undefined, names, null);
          if (BARE.test(words.prompt) || words.prompt === fallback.prompt) problems.push(`${effect.id} @${at} ${instruction.verb}: no entry, and the chain says "${words.prompt}"`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it("keys every entry to a real record, path and verb or option", () => {
    const problems: string[] = [];
    for (const key of Object.keys(asks)) {
      const parts = /^(\S+) @(\S+) (\S+)$/.exec(key);
      const effect = parts ? EFFECTS.find((one) => one.id === parts[1]) : undefined;
      let ok = false;
      if (parts && effect) walk(effect.instructions, (instruction, _next, _after, at) => {
        if (at === parts[2] && (instruction.verb === parts[3] || (instruction.verb === "Choose" && instruction.options.some((option) => option.id === parts[3])))) ok = true;
      });
      if (!ok) problems.push(key);
    }
    expect(problems).toEqual([]);
  });

  it("fills every template: no placeholder without a value, and none left in a sentence", () => {
    const problems: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction, _next, _after, at) => {
        const tails = [instruction.verb, ...(instruction.verb === "Choose" ? instruction.options.map((option) => option.id) : [])];
        for (const tail of tails) {
          const entry = asks[askKey(effect.id, at, tail)];
          if (!entry) continue;
          const key = askKey(effect.id, at, tail);
          const unknown = unknownPlaceholders(entry);
          if (unknown.length > 0) problems.push(`${key}: no value for ${unknown.map((name) => `{${name}}`).join(", ")}`);
          const asked = { game, ctx, names, instruction, source: effect.cardCode, effectId: effect.id, amountNow: 1 };
          const said = tail === "Choose" ? asksChoose(asked, asks)?.note : tail === instruction.verb ? asksPick(asked, asks) : asksOption(asked, tail, asks);
          const sentences = typeof said === "string" ? [said] : said ? Object.values({ ...("prompt" in said ? { prompt: said.prompt } : {}), ...("labels" in said ? said.labels : {}), ...("label" in said ? { label: said.label } : {}) }).filter((text): text is string => text != null) : [];
          if (entry.note !== undefined && sentences.length === 0) problems.push(`${key}: the note does not render`);
          lines.push(`${key}: ${sentences.join(" / ")}`);
          for (const text of sentences) if (/\{\w+\}/.test(text)) problems.push(`${key}: "${text}" has a placeholder left`);
        }
      });
    }
    expect(problems).toEqual([]);
  });
});

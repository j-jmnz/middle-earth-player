// Rules: rr.the-word-choose, rr.first-player (data/rules/entries.json). The asks files (src/play/words/asks/<scenario-id>.ts, read by asks.ts): templates, bindings, variants, cautions, the lookup by record and path
// (a filled-in copy of an instruction included), the barrel pnpm data build writes, and the checks a scenario with an asks file passes: every Pick and Choose is worded (by the shared judgement of
// test/harness/words-judge.ts), every key names a record path of a card the scenario deals, every template fills, every sentence is short. `WORDS_DUMP=<scenario-id>` (or `all`) prints each sentence.
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import type { Condition, Instruction } from "../../catalog/boundary.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { EFFECTS } from "../../effects/index.ts";
import { blankScenario } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { loadCards } from "../../../scripts/data/load-cards.ts";
import { dealtCodes, loadCampaigns, loadAnyScenario } from "../../../scripts/data/load-scenarios.ts";
import { ROOT } from "../../../scripts/data/paths.ts";
import { asksFileNames, checkAsksNames, renderAsksBarrel } from "../../../scripts/data/effects/asks-barrel.ts";
import { walk } from "../../../test/harness/record-walk.ts";
import { judgeBranch, judgePick } from "../../../test/harness/words-judge.ts";

import { askWords } from "./ask.ts";
import { dealtNow } from "./scenarios/aflame.ts";
import { askAt, askKey, askValues, asksChoose, asksOption, asksPick, fill, placeholdersOf, templatesOf, textsOf, unknownPlaceholders, type Ask, type AsksTable } from "./asks.ts";
import { ASKS_BY_SCENARIO } from "./asks/index.ts";
import { pickWords, type ChoiceNames } from "./choice.ts";
import { pathOf } from "./record-path.ts";
import { askedSeat } from "./seat.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";

const cards = new Map(loadCards().map((card) => [card.code, card]));
const campaigns = loadCampaigns();
const names: ChoiceNames = { card: (key) => cards.get(key)?.name ?? key, code: (code) => cards.get(code)?.name ?? code };
const ctx: ReduceContext = { effects: EFFECTS, cards: new Map() };
const tableOf = (id: string, seatCount: 1 | 2 = 2) => {
  const scenario = loadAnyScenario(id);
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
  [askKey(RECORD, "0.exhaust.0", "Pick")]: { verb: "Exhaust", note: "Choose a ready character you control to exhaust.", owned: true, labels: { skip: "Exhaust no one ({owner})" } },
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

  it("leads an owned note with no reason as every family does: \"Player 1: choose ...\" two-handed, capitalised solo, whichever way the entry wrote the first word", () => {
    const own: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: "Choose how {card} is paid.", owned: true } };
    expect(asksChoose(facts(choose), own)).toEqual({ note: "Player 1: choose how Urdug's Elite is paid.", owned: true });
    const lower: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: "choose how {card} is paid.", owned: true } };
    expect(asksChoose(facts(choose, 1), lower)).toEqual({ note: "Choose how Urdug's Elite is paid.", owned: false });
  });

  it("keeps the capital of a card's name that opens an owned note", () => {
    const named: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: "Grishnákh takes {card}.", owned: true } };
    expect(asksChoose(facts(choose), named)).toEqual({ note: "Player 1: Grishnákh takes Urdug's Elite.", owned: true });
  });

  it("words a branch: its row from the entry keyed with the option id, and its caution only when the condition holds", () => {
    expect(asksOption(facts(choose), "exhaust", table)).toEqual({ label: "Exhaust a character you control" });
    // A Choose has no {n} of its own (the entry binds the number it says): the row's own bind fills it.
    expect(asksOption(facts(choose), "progress", table)).toEqual({ label: "Place 2 progress", caution: "Tap again: 2 progress on Urdug's Elite" });
    // 0 < players is true with one player, so the caution holds there too; with the condition reversed it does not.
    const never: AsksTable = { [askKey(RECORD, "0", "progress")]: { label: "Place 1", caution: { when: { kind: "less", left: { players: true }, right: 0 }, text: "Tap again: no" } } };
    expect(asksOption(facts(choose), "progress", never)).toEqual({ label: "Place 1" });
  });

  it("words a Pick: the verb, the sentence, the rows that are no card, and no caution while its condition fails", () => {
    expect(asksPick(facts(pick), table)).toEqual({ verb: "Exhaust", prompt: "Player 1: choose a ready character you control to exhaust.", owned: true, labels: { skip: "Exhaust no one (Player 1)" } });
    expect(asksPick(facts(pick, 1), table)?.prompt).toBe("Choose a ready character you control to exhaust.");
  });

  it("arms a Pick's caution on the row that loses the game only: its condition is read with that row picked", () => {
    // One option lies in the staging area, the other in the discard pile: the warning is for the first row alone.
    const made = tableFromLayout("the-fate-of-wilderland", { seats: 2, staging: ["19164"], discard: ["19163"] });
    const inStaging = idOf(made.state, "19164");
    const discarded = idOf(made.state, "19163");
    const rows: AsksTable = { [askKey(RECORD, "0.exhaust.0", "Pick")]: { note: "Choose one.", caution: { when: { kind: "matches", card: "picked", inStaging: true }, text: "Tap again: {card} is lost" } } };
    const said = asksPick({ ...facts(pick), game: made.state, ctx: made.ctx, options: [inStaging, discarded, "skip"] }, rows);
    expect(said?.cautions).toEqual({ [inStaging]: "Tap again: Urdug's Elite is lost" });
  });

  it("says the words that fit the table now: the first variant whose condition holds, and none when none does", () => {
    const players: Condition = { kind: "less", left: 0, right: { players: true } };
    const never: Condition = { kind: "less", left: { players: true }, right: 0 };
    const stage: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: [{ when: never, text: "{card} is in the staging area." }, { when: players, text: "{card} is in play." }, { text: "never said" }] } };
    expect(asksChoose(facts(choose), stage)?.note).toBe("Urdug's Elite is in play.");
    const last: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: [{ when: never, text: "A" }, { text: "B" }] } };
    expect(asksChoose(facts(choose), last)?.note).toBe("B");
    const none: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: [{ when: never, text: "A" }] } };
    expect(asksChoose(facts(choose), none)).toBeUndefined();
    const rows: AsksTable = { [askKey(RECORD, "0", "exhaust")]: { label: [{ when: never, text: "Row A" }, { text: "Row B" }], caution: { when: players, text: [{ when: never, text: "Tap again: one" }, { text: "Tap again: two" }] } } };
    expect(asksOption(facts(choose), "exhaust", rows)).toEqual({ label: "Row B", caution: "Tap again: two" });
    expect(textsOf(rows[askKey(RECORD, "0", "exhaust")]!.label)).toEqual(["Row A", "Row B"]);
    expect(templatesOf(rows[askKey(RECORD, "0", "exhaust")]!)).toEqual(["Row A", "Row B", "Tap again: one", "Tap again: two"]);
  });

  it("is keyed by the record and the path: another record or another instruction gets no entry, and a missing entry returns undefined for the chain", () => {
    const other = EFFECTS.find((effect) => effect.id === "19164:whenRevealed:1")!.instructions[0]!;
    expect(asksChoose({ ...facts(other), source: "19164" }, table)).toBeUndefined();
    expect(asksChoose(facts(choose), {})).toBeUndefined();
    expect(asksPick(facts(pick), {})).toBeUndefined();
    expect(asksOption(facts(choose), "exhaust", {})).toBeUndefined();
    // The Pick has no entry keyed "Choose", and the Choose none keyed "Pick".
    expect(asksPick(facts(choose), table)).toBeUndefined();
    // With no table given, a game reads its own scenario's file: none exists for this one (asks-scope.test.ts has one that does).
    const unfiled = { ...facts(choose), game: { ...facts(choose).game, scenarioId: "no-such-scenario" } };
    expect(asksChoose(unfiled)).toBeUndefined();
    expect(askAt(unfiled)).toBeNull();
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

  it("finds the path of a copy the engine filled in (taken, kept, bottom), and none when two instructions fit it alike", () => {
    // Corsair Skirmisher asks with { ...instruction, taken } (families/sea/skirmisher.ts).
    const skirmisher = EFFECTS.find((effect) => effect.id === "12125:response:1")!;
    const drawn = skirmisher.instructions[0]!;
    const taken = { ...drawn, taken: ["i4"] } as Instruction;
    expect(JSON.stringify(taken)).not.toBe(JSON.stringify(drawn));
    expect(pathOf(skirmisher.instructions, taken)).toBe("0");
    const asked: AsksTable = { [askKey("12125:response:1", "0", "DiscardAlliesForWillpower")]: { verb: "Discard", note: "Choose an ally to discard." } };
    expect(asksPick({ game: tableOf("a-storm-on-cobas-haven"), ctx, names, instruction: taken, source: "12125" }, asked)?.prompt).toBe("Choose an ally to discard.");
    const twin = [{ verb: "Pick", pick: { type: "hero" } }, { verb: "Pick", pick: { type: "hero" } }] as unknown as Instruction[];
    expect(pathOf(twin, { ...twin[0]!, taken: [] } as Instruction)).toBeNull();
    expect(pathOf(twin, twin[1]!)).toBe("1");
  });

  it("is never shown half filled: a placeholder with no value drops the entry, and the static check names it", () => {
    const broken: AsksTable = { [askKey(RECORD, "0", "Choose")]: { note: "{card}: {missing} of {n}." } };
    expect(asksChoose(facts(choose), broken)).toBeUndefined();
    expect(unknownPlaceholders({ note: "{card}: {missing} of {n}", label: "{other}", bind: { held: 1 } })).toEqual(["missing", "other"]);
    // {n} is what the instruction after a Pick deals: a Choose has none, so there it is a missing value.
    expect(unknownPlaceholders({ note: "{card}: {n}" }, false)).toEqual(["n"]);
    expect(asksChoose({ ...facts(choose), amountNow: 2 }, { [askKey(RECORD, "0", "Choose")]: { note: "{n}." } })?.note).toBe("2.");
    expect(placeholdersOf("{a} and {b_1}")).toEqual(["a", "b_1"]);
    expect(fill("{a}-{b}", { a: 1 })).toBeNull();
    expect(fill("{a}-{b}", { a: 1, b: "x" })).toBe("1-x");
    expect(askValues(facts(choose), { bind: { held: 3 } }).values).toMatchObject({ card: "Urdug's Elite", owner: "Player 1", held: 3 });
  });

  it("is read first by askWords, and with no entry askWords answers as pickWords does", () => {
    // A game of a scenario with no asks file: whatever files exist, the entry-free chain answers.
    const game = { ...tableOf("the-fate-of-wilderland"), scenarioId: "no-such-scenario" };
    const ask = { game, ctx, names, instruction: pick, queue: [], options: [], source: "19158", picked: null };
    expect(askWords(ask)).toEqual(pickWords(pick, undefined, names, "19158", 2, game, undefined, []));
  });
});

describe("the barrel of asks files", () => {
  it("is the one pnpm data build writes (src/play/words/asks/index.ts)", () => {
    const dir = path.join(ROOT, "src", "play", "words", "asks");
    expect(readFileSync(path.join(dir, "index.ts"), "utf8"), "run pnpm data build").toBe(renderAsksBarrel(asksFileNames(dir)));
  });

  it("imports each file under an upper-case name and lists them by scenario id", () => {
    const barrel = renderAsksBarrel(["a-b", "c"]);
    expect(barrel).toContain(`import { ASKS as A_B } from "./a-b.ts";`);
    expect(barrel).toContain(`export const ASKS_BY_SCENARIO: Readonly<Record<string, Readonly<Record<string, Ask>>>> = { "a-b": A_B, "c": C };`);
    expect(barrel).not.toContain("...A_B");
  });

  it("names only scenarios of data/", () => {
    expect(() => checkAsksNames(["the-fate-of-wilderland"], [{ id: "the-fate-of-wilderland" }])).not.toThrow();
    expect(() => checkAsksNames(["no-such"], [{ id: "the-fate-of-wilderland" }])).toThrow(/named for no scenario/);
  });
});

// A scenario with an asks file has its words as data, and these checks stand in for the words code it has none of.
const dump = process.env.WORDS_DUMP;
const LIMIT = 25;
const wordsIn = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
// A card id the game makes (i12) or a card code: a row of a Pick that names a card is that card's, and a label may not rename it.
const CARD_LIKE = /^(i\d+|\d{5,6})$/;
describe.each(Object.keys(ASKS_BY_SCENARIO))("the asks of %s", (id) => {
  const asks = ASKS_BY_SCENARIO[id]!;
  const scenario = loadAnyScenario(id);
  const codes = dealtCodes(campaigns, [scenario], { nightmare: true });
  const records = EFFECTS.filter((effect) => codes.has(effect.cardCode));
  const game = tableOf(id);
  const judged = { game, ctx, names };
  const lines: string[] = [];
  afterAll(() => {
    if (dump === id || dump === "all") process.stdout.write(`\n${id}\n${lines.join("\n")}\n`);
  });

  it("words every Pick and Choose with an entry, or with words that are neither bare nor the fallback", () => {
    const problems: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction, next, after, at) => {
        const verdict = judgePick(judged, effect, instruction, next, after, at);
        if (verdict?.problem) problems.push(`${verdict.key}: ${verdict.problem}`);
        // A Choose with no note entry is worded by its rows: each branch has a label entry or words that are not the fallback.
        if (instruction.verb === "Choose") {
          for (const option of instruction.options) {
            const row = judgeBranch(judged, effect, instruction, option.id, at);
            if (row.problem) problems.push(`${row.key}: ${row.problem}`);
          }
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it("keys every entry to a record of a card the scenario deals, a path and a verb or option", () => {
    const problems: string[] = [];
    for (const key of Object.keys(asks)) {
      const parts = /^(\S+) @(\S+) (\S+)$/.exec(key);
      const effect = parts ? EFFECTS.find((one) => one.id === parts[1]) : undefined;
      if (effect && !codes.has(effect.cardCode)) problems.push(`${key}: ${effect.cardCode} is not dealt by ${id}`);
      let ok = false;
      if (parts && effect) walk(effect.instructions, (instruction, _next, _after, at) => {
        if (at === parts[2] && (instruction.verb === parts[3] || (instruction.verb === "Choose" && instruction.options.some((option) => option.id === parts[3])))) ok = true;
      });
      if (!ok) problems.push(`${key}: names no record path`);
    }
    expect(problems).toEqual([]);
  });

  it("keeps each entry in the form docs/design-system-table.md (Choice tray) gives: a short verb, labels on options that are no card, cautions that start \"Tap again:\"", () => {
    const problems: string[] = [];
    for (const [key, entry] of Object.entries(asks)) {
      if (entry.verb !== undefined && (wordsIn(entry.verb) < 1 || wordsIn(entry.verb) > 2)) problems.push(`${key}: the verb "${entry.verb}" is not one or two words`);
      for (const label of Object.keys(entry.labels ?? {})) if (CARD_LIKE.test(label)) problems.push(`${key}: labels["${label}"] names a card, and a card's row keeps its own name`);
      for (const text of textsOf(entry.caution?.text)) if (!text.startsWith("Tap again:")) problems.push(`${key}: the caution "${text}" does not start "Tap again:"`);
    }
    expect(problems).toEqual([]);
  });

  it("fills every template as the sheet would: no placeholder without a value, and none left in a sentence", () => {
    const problems: string[] = [];
    for (const effect of records) {
      walk(effect.instructions, (instruction, next, _after, at) => {
        const tails = [instruction.verb, ...(instruction.verb === "Choose" ? instruction.options.map((option) => option.id) : [])];
        for (const tail of tails) {
          const key = askKey(effect.id, at, tail);
          const entry = asks[key];
          if (!entry) continue;
          // A Pick's {n} is what the instruction after it deals, read now; a Choose and its branches have none.
          const asksCard = instruction.verb !== "Choose";
          const now = asksCard ? dealtNow(game, ctx, next, askedSeat(game), effect.cardCode) : undefined;
          const asked = { game, ctx, names, instruction, source: effect.cardCode, effectId: effect.id, options: [], ...(now !== undefined ? { amountNow: now } : {}), ...(asksCard ? { again: () => 0 } : {}) };
          const unknown = unknownPlaceholders(entry, asksCard);
          if (unknown.length > 0) problems.push(`${key}: no value for ${unknown.map((name) => `{${name}}`).join(", ")}`);
          // Every template, each variant and each caution, whether its condition holds on this table or not.
          const { values } = askValues(asked, entry);
          const texts: string[] = [];
          for (const template of templatesOf(entry)) {
            const text = fill(template, values);
            if (text === null) problems.push(`${key}: "${template}" does not render (a placeholder has no value here)`);
            else texts.push(text);
          }
          // The sentence the sheet opens with, led as the sheet leads it.
          const said = tail === "Choose" ? asksChoose(asked, asks)?.note : tail === instruction.verb ? asksPick(asked, asks)?.prompt : undefined;
          if (typeof entry.note === "string" && said === undefined && tail === instruction.verb) problems.push(`${key}: the note does not render`);
          // The sheet says the entry's own sentence: a record that holds the same object at two paths (Brace of Coneys' two Chooses) would match the first and say the other's.
          const own = typeof entry.note === "string" ? fill(entry.note, values) : null;
          if (own !== null && said !== undefined && !said.toLowerCase().includes(own.toLowerCase())) problems.push(`${key}: the sheet says "${said}", not the entry's "${own}" (another instruction of the record was matched)`);
          if (said !== undefined) texts.push(said);
          lines.push(`${key}: ${[...new Set(texts)].join(" / ")}`);
          for (const text of texts) {
            if (/\{\w+\}/.test(text)) problems.push(`${key}: "${text}" has a placeholder left`);
            // The sentence-length rule of src/play/words/sentence-length.test.ts: split after . ! ? and count words.
            for (const part of text.split(/(?<=[.!?])\s+/)) if (wordsIn(part) > LIMIT) problems.push(`${key}: (${wordsIn(part)} words) ${part}`);
          }
        }
      });
    }
    expect(problems).toEqual([]);
  });
});

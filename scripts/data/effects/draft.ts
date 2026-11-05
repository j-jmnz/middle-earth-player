import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse as parseJsonc } from "jsonc-parser";

import { EFFECTS } from "../../../src/effects/index.ts";
import { copyLine, withCopies } from "../../../src/effects/authored/reprint.ts";
import { splitCodes } from "../../codes.ts";
import { runScript, type Log } from "../../log.ts";
import type { Effect } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import { MODE_CARD_CODE } from "../../../src/catalog/scenario-data.ts";
import { prebuiltDecksSchema } from "../../../src/catalog/prebuilt-deck.ts";
import { HOB_ONLY_PACKS } from "../campaign-defs.ts";
import { loadCards } from "../load-cards.ts";
import { dealtCodes, gameCodes, loadCampaigns, loadScenario, loadScenarios, nightmareCodes, starterCodes } from "../load-scenarios.ts";
import { keyOf, loadLedger } from "../printed/ledger.ts";
import { isPoolCard, withPool } from "../printed/pool.ts";
import { DATA_DIR, RAW_DIR, ROOT } from "../paths.ts";
import type { RuleEntry } from "../rules/spans.ts";
import { generateEffects, segmentsOf, selfNamed, type Segment, type Unmatched } from "./generate.ts";
import { vocabulary, vocabularyMarkdown } from "./vocabulary.ts";

// Usage: node --experimental-strip-types scripts/data/effects/draft.ts <scenario-id | starter-deck-id | prebuilt-deck-id | pack | code,code,... | code code ...>
// Writes .agent/drafts/<code>.md for every card in the scenario, the starter or pre-built deck (data/decks/prebuilt.json), the player pack (a data/cards file name,
// "Core", "TRD"), or the list of codes (separated by commas or spaces), that has a printed line no record covers yet. With --all it also drafts the lines
// that authored records already cover, to review or redo them.

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

function overlap(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(1, a.size + b.size - shared);
}

// The authored files that export records (a scenario's `AUTHORED_EFFECTS`, a pool or family file's `RECORDS`), with the records each holds: where a record to copy is written.
type Holder = { file: string; exported: "AUTHORED_EFFECTS" | "RECORDS"; records: ReadonlySet<Effect> };

function authoredFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? authoredFiles(full) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

async function loadHolders(): Promise<Holder[]> {
  const holders: Holder[] = [];
  for (const full of authoredFiles(path.join(ROOT, "src", "effects", "authored"))) {
    const loaded = (await import(pathToFileURL(full).href)) as Record<string, unknown>;
    for (const exported of ["AUTHORED_EFFECTS", "RECORDS"] as const) {
      const list = loaded[exported];
      if (Array.isArray(list)) holders.push({ file: path.relative(ROOT, full).replaceAll(path.sep, "/"), exported, records: new Set(list as Effect[]) });
    }
  }
  return holders;
}

async function main(log: Log): Promise<void> {
  const targets = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const pieces = splitCodes(targets);
  const campaigns = loadCampaigns();
  const cards = loadCards();
  // Codes: every piece is a known card code. Anything else is one name (a scenario, deck or pack id).
  const known = new Set(cards.map((card) => card.code));
  const asCodes = pieces.length > 0 && pieces.every((piece) => known.has(piece));
  const scenarioId = asCodes ? pieces.join(",") : targets[0];
  if (!scenarioId) throw new Error("Usage: effects:draft <scenario-id | starter-deck-id | prebuilt-deck-id | pack | code,code,... | code code ...>");
  const prebuilt = prebuiltDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "prebuilt.json"), "utf8")) as unknown).find((entry) => entry.id === scenarioId);
  const deck = campaigns.flatMap((campaign) => campaign.starterDecks).find((entry) => entry.id === scenarioId) ?? (prebuilt ? { id: prebuilt.id, rows: [...prebuilt.heroes.map((code) => ({ code })), ...prebuilt.cards] } : undefined);
  const packCodes = cards.filter((card) => isPoolCard(card) && card.printings[0]?.pack === scenarioId).map((card) => card.code);
  const listed = asCodes ? pieces : [];
  const chosen = deck ? deck.rows.map((row) => row.code) : packCodes.length > 0 ? packCodes : listed;
  const scenario = chosen.length > 0 ? null : loadScenario(scenarioId);
  log.info(deck ? `deck ${deck.id}: ${deck.rows.length} rows` : packCodes.length > 0 ? `pack ${scenarioId}: ${packCodes.length} player cards` : listed.length > 0 ? `${listed.length} cards` : `scenario ${scenarioId}`);
  const ledger = withPool(loadLedger(), cards);
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
  const vocab = vocabulary();
  const automation = new Map<string, unknown>();
  for (const file of ["encounterCards.json", "playerCards.json", "basicAttachments-GENERATED.json", "globalPassiveEffects-GENERATED.json", "localPassiveEffects-GENERATED.json", "globalActionEffects-GENERATED.json", "questAutomation.json"]) {
    const parsed = parseJsonc(readFileSync(path.join(RAW_DIR, "dragncards", file), "utf8")) as { automation?: { cards?: Record<string, unknown> } };
    for (const [guid, rules] of Object.entries(parsed.automation?.cards ?? {})) automation.set(guid, rules);
  }

  // A card named by code may be a scenario card (12161), which only a scenario that deals it brings into scope.
  const generated = generateEffects(cards, scenario ? [scenario] : listed.length > 0 ? loadScenarios() : [], campaigns, ledger);
  // Every card the scenario deals: its piles, its campaign card, the cards that card places (campaignPlaced) and the prelude.
  const dealt = chosen.length > 0 ? new Set(chosen) : dealtCodes(campaigns, scenario ? [scenario] : []);
  const all = process.argv.includes("--all");
  // A line the ledger marks inert (a reminder, a keyword the engine reads) is owned and needs no record.
  const inert = (lineId: string): boolean => {
    const [code = "", side = "", n] = lineId.split(":");
    return ledger.byKey.get(keyOf(code, side))?.inert.some((mark) => mark.line === Number(n)) ?? false;
  };
  const open: Unmatched[] = generated.unmatched.filter((line) => dealt.has(line.card.code) && (all || (!inert(line.lineId) && !EFFECTS.some((effect) => effect.lines.includes(line.lineId)))));
  const byCard = new Map<string, Unmatched[]>();
  for (const line of open) byCard.set(line.card.code, [...(byCard.get(line.card.code) ?? []), line]);

  // Where a card's records go: a pool card's pack file, a boon or burden of a Hall-of-Beorn-only box (the Revised Core Set, The Dark
  // of Mirkwood; HOB_ONLY_PACKS) in that pack's pool file (src/effects/authored/pool/RevCore.ts, TDoM.ts: the plan's phases 29 to
  // 33 table puts them there), the Fellowship box's cards in the Fellowship file, and any other box card in the file of the
  // first scenario that deals it (src/effects/authored/<scenario-id>.ts).
  const starters = starterCodes(campaigns);
  const fellowship = new Set(campaigns.find((entry) => entry.id === "fellowship-of-the-ring")?.scenarios ?? []);
  const scenarios = loadScenarios();
  const targetOf = (card: Card): string => {
    const pack = card.printings[0]?.pack;
    // The Hard/Expert Mode card is dealt by every scenario of a campaign with XP: its records sit with the Campaign Expansion's own cards.
    if (card.code === MODE_CARD_CODE) return "src/effects/authored/pool/DCCE.ts";
    if ((isPoolCard(card) && !starters.has(card.code)) || (card.campaignKind != null && (pack != null && HOB_ONLY_PACKS.has(pack)))) return `src/effects/authored/pool/${pack}.ts`;
    // A Nightmare deck's cards go in the Nightmare file of its scenario (docs/plans/nightmare-mode.md).
    const nightmareOf = scenarios.find((entry) => nightmareCodes([entry]).has(card.code));
    if (nightmareOf) return `src/effects/authored/nightmare/${nightmareOf.id}.ts`;
    const dealer = scenarios.find((entry) => dealtCodes([], [entry]).has(card.code) || gameCodes(campaigns, entry).includes(card.code));
    return dealer && !fellowship.has(dealer.id) ? `src/effects/authored/${dealer.id}.ts` : "src/effects/authored/fellowship-of-the-ring.ts";
  };

  // Every printed line of every card, by its text as generate.ts normalizes it, and the records that own each line.
  const segmentById = new Map<string, Segment>();
  const byText = new Map<string, Segment[]>();
  for (const card of cards) {
    for (const segment of segmentsOf(card, ledger)) {
      segmentById.set(segment.lineId, segment);
      const key = selfNamed(card, segment.line);
      byText.set(key, [...(byText.get(key) ?? []), segment]);
    }
  }
  const ownersOf = new Map<string, Effect[]>();
  for (const effect of EFFECTS) for (const id of effect.lines) ownersOf.set(id, [...(ownersOf.get(id) ?? []), effect]);
  const twinsOf = (line: Unmatched): { lineId: string; card: Card; records: Effect[] }[] =>
    (byText.get(selfNamed(line.card, line.line)) ?? [])
      .filter((other) => other.card.code !== line.card.code && (ownersOf.get(other.lineId)?.length ?? 0) > 0)
      .map((other) => ({ lineId: other.lineId, card: other.card, records: ownersOf.get(other.lineId) ?? [] }));
  const effectTexts = new Map<Effect, Set<string>>();
  const textWords = (effect: Effect): Set<string> => {
    const known = effectTexts.get(effect);
    if (known) return known;
    const made = wordSet(effect.lines.map((id) => segmentById.get(id)?.line ?? "").join(" "));
    effectTexts.set(effect, made);
    return made;
  };
  const nearest = (line: Unmatched): { lineId: string; text: string; effect: Effect }[] => {
    const own = wordSet(line.line);
    return EFFECTS.filter((effect) => effect.cardCode !== line.card.code && effect.lines.length > 0)
      .map((effect) => ({ effect, score: overlap(own, textWords(effect)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ effect }) => ({ lineId: effect.lines.join(", "), text: effect.lines.map((id) => segmentById.get(id)?.line ?? "").join(" "), effect }));
  };
  // The id a record takes: the number generate reserved for a labelled line. An unlabelled line (a constant or triggered ability, as
  // generate classifies it) reserves none, so its record takes the first number of that timing no generated or authored record on the card uses.
  const taken = new Set([...generated.effects, ...EFFECTS].map((effect) => effect.id));
  const suggested = new Map<string, string>();
  const suggestedId = (line: Unmatched): string => {
    const known = suggested.get(line.lineId);
    if (known) return known;
    let id = `${line.card.code}:${line.timing}:${line.number}`;
    if (!line.timing) {
      const form = line.form ?? "constant";
      let n = line.number;
      while (taken.has(`${line.card.code}:${form}:${n}`)) n += 1;
      taken.add(`${line.card.code}:${form}:${n}`);
      id = `${line.card.code}:${form}:${n}`;
    }
    suggested.set(line.lineId, id);
    return id;
  };

  // The open lines of the batch that print the same sentence once each card's own name is {self}: the first is written, the others take its record.
  const batchGroups = new Map<string, Unmatched[]>();
  for (const line of open) {
    const key = selfNamed(line.card, line.line);
    batchGroups.set(key, [...(batchGroups.get(key) ?? []), line]);
  }
  const batchOf = (line: Unmatched): Unmatched[] => {
    const group = batchGroups.get(selfNamed(line.card, line.line)) ?? [];
    return group.length > 1 ? group : [];
  };

  // The `{ pool: ... }` import withCopies needs when the records to copy are written in another file than the copy's: the file that holds them (a scenario's AUTHORED_EFFECTS, a pool or
  // family file's RECORDS), found by the records themselves. A generated record is in no authored file and needs no import.
  const holders = await loadHolders();
  const holderOf = (records: readonly Effect[]): Holder | undefined => holders.find((holder) => records.some((record) => holder.records.has(record)));
  const stemOf = (file: string): string => path.basename(file, ".ts");
  const words = (file: string): string[] => stemOf(file).split("-").filter((word) => word !== "the" && word !== "a");
  // The first word of the stem (RAID, VOYAGE), the whole stem when another authored file starts with the same word (FLIGHT_OF_THE_STORMCALLER, FLIGHT_TO_THE_FORD).
  const aliasOf = (file: string): string => {
    const first = (words(file)[0] ?? stemOf(file)).toUpperCase();
    const shared = holders.some((other) => other.file !== file && (words(other.file)[0] ?? "").toUpperCase() === first);
    return file.includes("/pool/") ? stemOf(file).toUpperCase() : shared ? stemOf(file).toUpperCase().replaceAll("-", "_") : first;
  };
  const poolImport = (twinRecords: readonly Effect[], copyCard: Card): string[] => importFrom(holderOf(twinRecords), copyCard);
  // A record of the batch is not written yet: the file it will go in is where targetOf puts its card.
  const plannedImport = (sourceCard: Card, copyCard: Card): string[] => {
    const file = targetOf(sourceCard);
    return importFrom({ file, exported: file.includes("/pool/") ? "RECORDS" : "AUTHORED_EFFECTS", records: new Set() }, copyCard);
  };
  const importFrom = (holder: Holder | undefined, copyCard: Card): string[] => {
    const to = targetOf(copyCard);
    if (holder === undefined || holder.file === to) return [];
    const alias = aliasOf(holder.file);
    const relative = path.relative(path.dirname(to), holder.file).replaceAll(path.sep, "/");
    return [`In ${to}: \`import { ${holder.exported} as ${alias} } from "${relative.startsWith(".") ? relative : `./${relative}`}";\` and pass \`{ pool: ${alias} }\` as the second argument of \`withCopies\`.`];
  };
  // The id the copy takes, as withCopies numbers it among the card's records already written; the error withCopies throws, when it refuses.
  const copiedIds = (twin: { lineId: string; card: Card }, line: Unmatched): string => {
    try {
      const made = withCopies([...EFFECTS.filter((effect) => effect.cardCode === line.card.code), copyLine(twin.lineId, line.lineId)], { pool: EFFECTS.filter((effect) => effect.cardCode === twin.card.code) });
      return made.filter((effect) => effect.lines.includes(line.lineId)).map((effect) => effect.id).join(", ") || suggestedId(line);
    } catch (error) {
      return `withCopies refuses: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  const out = path.join(ROOT, ".agent", "drafts");
  mkdirSync(out, { recursive: true });
  // A draft left from an earlier run names lines that may be owned since: clear them (vocabulary.md is rewritten below).
  const stale = readdirSync(out).filter((name) => name.endsWith(".md") && name !== "vocabulary.md");
  for (const name of stale) rmSync(path.join(out, name));
  log.debug(`removed ${stale.length} stale draft${stale.length === 1 ? "" : "s"} from .agent/drafts`);
  writeFileSync(path.join(out, "vocabulary.md"), vocabularyMarkdown(vocab));
  for (const [code, lines] of byCard) {
    const card = byCode.get(code) as Card;
    const guid = card.printings.find((printing) => printing.octgnGuid)?.octgnGuid;
    const sections: string[] = [
      `# ${code} ${card.name}`,
      ``,
      `Scenario: ${scenarioId}. Write the records into ${targetOf(card)}, each with \`lines\` naming the line ids above, then run \`pnpm effects:open\`, \`pnpm vitest run scripts/checks/effect-coverage.test.ts\` and the scenario tests.`,
      ``,
      `## Lines without a record`,
      ...lines.map((line) => `- ${line.lineId} (${line.side}${line.timing ? `, ${line.timing}` : ""}) ${line.line}`),
      ``,
      `## Text of every printing`,
      ...card.printings.map((printing) => `- ${printing.pack} #${printing.number} (${printing.hobSlug ?? "RingsDB"})`),
      ``,
      "```",
      [card.text, card.back?.text && `Side B: ${card.back.text}`, card.shadowText].filter(Boolean).join("\n"),
      "```",
      ``,
      `## DragnCards automation`,
      guid && automation.has(guid) ? ["```json", JSON.stringify(automation.get(guid), null, 2), "```"].join("\n") : "None.",
      ``,
      `## Rules text that mentions its terms`,
    ];
    const haystack = lines.map((line) => line.line.toLowerCase()).join(" ");
    const related = entries.filter((entry) => (entry.doc === "rr" || entry.doc === "mec109") && entry.terms.some((term) => term.length >= 6 && haystack.includes(term))).slice(0, 6);
    for (const entry of related) sections.push(`### ${entry.id} (${entry.doc} p${entry.page})`, entry.text.slice(0, 900), ``);
    sections.push(`## Vocabulary`, `[vocabulary.md](vocabulary.md)`, ``, `## Line by line`, ``);
    for (const line of lines) {
      const twins = twinsOf(line);
      const batch = batchOf(line);
      const [writer = line] = batch;
      sections.push(`### ${line.lineId}: ${line.line}`, ``, `Record id: \`${suggestedId(line)}\``, ``);
      if (twins.length > 0) {
        sections.push(`Exact match: the same text, with the card name as {self}, is owned elsewhere. Copy the records below, with this card's code, line id and number.`, ``);
        for (const twin of twins) {
          sections.push(`${twin.lineId} (card ${twin.card.name}): \`${`copyLine("${twin.lineId}", "${line.lineId}")`}\`, record id \`${copiedIds(twin, line)}\``, ``, "```json", ...twin.records.map((effect) => JSON.stringify(effect)), "```", ``);
          sections.push(...poolImport(twin.records, line.card).map((text) => `${text}`), ``);
        }
      } else if (batch.length > 0 && writer.lineId !== line.lineId) {
        sections.push(`Twin in this batch: the same text, with the card name as {self}, as ${writer.lineId} (card ${writer.card.name}). Write no record here: take ${writer.lineId}'s with \`${`copyLine("${writer.lineId}", "${line.lineId}")`}\` (record id \`${suggestedId(line)}\` if the source is of that timing; withCopies numbers it).`, ``);
        sections.push(...plannedImport(writer.card, line.card), ``);
      } else if (batch.length > 0) {
        const copies = batch.slice(1);
        sections.push(`Twins in this batch: the same text, with the card name as {self}, as ${copies.map((other) => other.lineId).join(", ")}. Write this line's record once; the others take it:`, ``);
        for (const other of copies) sections.push(`- \`${`copyLine("${line.lineId}", "${other.lineId}")`}\` (card ${other.card.name}, record id \`${suggestedId(other)}\`)${plannedImport(line.card, other.card).map((text) => `. ${text}`).join("")}`);
        sections.push(``);
      } else {
        sections.push(`Nearest records for this line:`, ``);
        for (const item of nearest(line)) sections.push(`${item.lineId}: ${item.text.slice(0, 300)}`, "```json", JSON.stringify(item.effect), "```", ``);
      }
    }
    writeFileSync(path.join(out, `${code}.md`), `${sections.join("\n")}\n`);
    log.debug(`${code}.md: ${lines.length} line${lines.length === 1 ? "" : "s"} (${lines.map((line) => line.lineId).join(", ")})`);
  }
  log.info(`${byCard.size} drafts (${open.length} lines) in .agent/drafts for ${scenarioId}; ${Object.values(generated.usage).reduce((sum, n) => sum + n, 0)} lines came from templates`);
}

void runScript("effects:draft", main);

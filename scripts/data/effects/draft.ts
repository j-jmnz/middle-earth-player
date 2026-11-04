import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";

import { EFFECTS } from "../../../src/effects/index.ts";
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

// Usage: node --experimental-strip-types scripts/data/effects/draft.ts <scenario-id | starter-deck-id | prebuilt-deck-id | pack | code,code,...>
// Writes .agent/drafts/<code>.md for every card in the scenario, the starter or pre-built deck (data/decks/prebuilt.json), the player pack (a data/cards file name,
// "Core", "TRD"), or the list of codes, that has a printed line no record covers yet. With --all it also drafts the lines
// that authored records already cover, to review or redo them.

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

function overlap(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(1, a.size + b.size - shared);
}

function main(log: Log): void {
  const scenarioId = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!scenarioId) throw new Error("Usage: effects:draft <scenario-id | starter-deck-id | prebuilt-deck-id | pack | code,code,...>");
  const campaigns = loadCampaigns();
  const cards = loadCards();
  const prebuilt = prebuiltDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "prebuilt.json"), "utf8")) as unknown).find((entry) => entry.id === scenarioId);
  const deck = campaigns.flatMap((campaign) => campaign.starterDecks).find((entry) => entry.id === scenarioId) ?? (prebuilt ? { id: prebuilt.id, rows: [...prebuilt.heroes.map((code) => ({ code })), ...prebuilt.cards] } : undefined);
  const packCodes = cards.filter((card) => isPoolCard(card) && card.printings[0]?.pack === scenarioId).map((card) => card.code);
  const listed = /^[0-9A-Za-z]+(,[0-9A-Za-z]+)+$|^\d{5,6}$/.test(scenarioId) ? scenarioId.split(",") : [];
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
    const made = words(effect.lines.map((id) => segmentById.get(id)?.line ?? "").join(" "));
    effectTexts.set(effect, made);
    return made;
  };
  const nearest = (line: Unmatched): { lineId: string; text: string; effect: Effect }[] => {
    const own = words(line.line);
    return EFFECTS.filter((effect) => effect.cardCode !== line.card.code && effect.lines.length > 0)
      .map((effect) => ({ effect, score: overlap(own, textWords(effect)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ effect }) => ({ lineId: effect.lines.join(", "), text: effect.lines.map((id) => segmentById.get(id)?.line ?? "").join(" "), effect }));
  };
  // The id a record takes: the number generate reserved for a labelled line. An unlabelled line (a constant ability) reserves
  // none, so its record takes the first number no generated or authored record on the card uses.
  const taken = new Set([...generated.effects, ...EFFECTS].map((effect) => effect.id));
  const suggestedId = (line: Unmatched): string => {
    if (line.timing) return `${line.card.code}:${line.timing}:${line.number}`;
    let n = line.number;
    while (taken.has(`${line.card.code}:constant:${n}`)) n += 1;
    taken.add(`${line.card.code}:constant:${n}`);
    return `${line.card.code}:constant:${n}`;
  };

  const out = path.join(ROOT, ".agent", "drafts");
  mkdirSync(out, { recursive: true });
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
      sections.push(`### ${line.lineId}: ${line.line}`, ``, `Record id: \`${suggestedId(line)}\``, ``);
      if (twins.length > 0) {
        sections.push(`Exact match: the same text, with the card name as {self}, is owned elsewhere. Copy the records below, with this card's code, line id and number.`, ``);
        for (const twin of twins) sections.push(`${twin.lineId} (card ${twin.card.name}):`, "```json", ...twin.records.map((effect) => JSON.stringify(effect)), "```", ``);
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

// What `pnpm effects render` prints: a list of cards (or a scenario's cards) as each card's printed ledger lines with the records that name them rendered as plain English, and the snapshot test that
// compares every playable scenario's text (render/snapshots.test.ts) reads through the same functions.
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Effect } from "../../../../src/catalog/boundary.ts";
import type { Card } from "../../../../src/catalog/card-facts.ts";
import { EFFECTS } from "../../../../src/effects/index.ts";
import type { Log } from "../../../log.ts";
import { loadCards } from "../../load-cards.ts";
import { dealtCodes, loadCampaigns, loadAnyScenario, nightmareCodes } from "../../load-scenarios.ts";
import { ROOT } from "../../paths.ts";
import { keyOf, lineId, loadLedger } from "../../printed/ledger.ts";
import { withPool } from "../../printed/pool.ts";
import { authoredRelOfScenario } from "../authored-paths.ts";
import { segmentsOf } from "../generate.ts";
import { renderCard } from "./cards.ts";
import type { Tally } from "./kit.ts";

export type RenderEnv = {
  cards: readonly Card[];
  byCode: ReadonlyMap<string, Card>;
  ledger: ReturnType<typeof withPool>;
  inertIds: ReadonlySet<string>;
};

export const NIGHTMARE_HEADING = "=== Nightmare deck (the cards the scenario's Nightmare deck adds) ===";

export type Rendered = { text: string; tally: Tally };

// Reads the cards and the ledger once; every render of a run shares them.
export function loadRenderEnv(): RenderEnv {
  const cards = loadCards();
  const ledger = withPool(loadLedger(), cards);
  return {
    cards,
    byCode: new Map(cards.map((card) => [card.code, card])),
    ledger,
    inertIds: new Set(ledger.entries.flatMap((entry) => entry.inert.map((mark) => `${entry.code}:${entry.side}:${mark.line}`))),
  };
}

// The cards the scenario's authored file has records for, or null when it has no such file (the caller says so and renders every dealt card). A file that fails to load throws: it is not "no file".
async function authoredCodes(scenarioId: string, log: Log, nightmare = false): Promise<Set<string> | null> {
  const rel = `src/effects/authored/${nightmare ? "nightmare/" : ""}${nightmare ? scenarioId : authoredRelOfScenario(scenarioId)}.ts`;
  if (nightmare && !existsSync(path.join(ROOT, rel))) return new Set();
  const file = path.join(ROOT, rel);
  if (!existsSync(file)) {
    log.warn(`${rel} does not exist: rendering every card the scenario deals (as --all-dealt does)`);
    return null;
  }
  const loaded = (await import(pathToFileURL(file).href)) as { AUTHORED_EFFECTS?: readonly Effect[] };
  if (!loaded.AUTHORED_EFFECTS) throw new Error(`${rel} exports no AUTHORED_EFFECTS`);
  return new Set(loaded.AUTHORED_EFFECTS.map((effect) => effect.cardCode));
}

// `piles`: where the scenario deals each code, so a card the piles place says so.
// `nightmare`: the scenario's Nightmare deck cards, printed after the others under their own heading.
export function renderCodes(env: RenderEnv, codes: readonly string[], piles: ReadonlyMap<string, string> = new Map(), nightmare: readonly string[] = []): Rendered {
  const sections: string[] = [];
  // The cards the scenario's piles place with no record (the staging and quest piles), so a Setup line that says "Add X to the staging area" is seen to be done by the piles.
  const placed = [...piles].filter(([, pile]) => pile !== "encounter").map(([code, pile]) => `${pile}: ${code} ${env.byCode.get(code)?.name ?? ""}`);
  if (placed.length > 0) sections.push(`Scenario piles that place cards with no record (${placed.join("; ")})`);
  const total = { template: 0, json: 0 };
  const heading = nightmare.length > 0 ? codes.length : -1;
  for (const [at, code] of [...codes, ...nightmare].entries()) {
    if (at === heading) sections.push(NIGHTMARE_HEADING);
    const card = env.byCode.get(code);
    if (!card) continue;
    const rawLines = (["A", "B"] as const).flatMap((side) => (env.ledger.byKey.get(keyOf(code, side))?.lines ?? []).map((line, at) => ({ lineId: lineId(code, side, at + 1), line })));
    const rendered = renderCard(card, segmentsOf(card, env.ledger), EFFECTS, env.inertIds, { ...(rawLines.length > 0 ? { rawLines } : {}), ...(piles.has(code) ? { pile: piles.get(code) } : {}) });
    total.template += rendered.tally.template;
    total.json += rendered.tally.json;
    sections.push(rendered.text);
  }
  return { text: `${sections.join("\n\n")}\n\n(rendered pieces: ${total.template} by template, ${total.json} as JSON)\n`, tally: total };
}

// A scenario's cards: the ones its authored file has records for (every dealt card with `allDealt`, or when it has no authored file).
export async function renderScenario(env: RenderEnv, scenarioId: string, allDealt: boolean, log: Log): Promise<Rendered> {
  const scenario = loadAnyScenario(scenarioId);
  const dealt = [...dealtCodes(loadCampaigns(), [scenario])];
  const owned = allDealt ? null : await authoredCodes(scenario.id, log);
  const deck = nightmareCodes([scenario]);
  const ownedDeck = allDealt ? null : await authoredCodes(scenario.id, log, true);
  const codes = dealt.filter((code) => (owned === null ? !deck.has(code) : owned.has(code) && !deck.has(code))).sort();
  const deckCodes = [...deck].filter((code) => (ownedDeck === null || ownedDeck.has(code)) && dealt.includes(code)).sort();
  log.info(`scenario ${scenario.id}: ${codes.length + deckCodes.length} cards`);
  return renderCodes(env, codes, new Map(scenario.cards.map((card) => [card.code, card.pile])), deckCodes);
}

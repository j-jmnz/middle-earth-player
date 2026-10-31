import { describe, expect, it } from "vitest";

import { NIGHTMARE_PLAYABLE, PLAYABLE_SCENARIOS as PLAYABLE } from "../src/campaign/playable.ts";
import { AUTHORED_EFFECTS, AUTHORED_REPLACES, EFFECTS, GENERATED_EFFECTS } from "../src/effects/index.ts";
import { textCheck, unappliedLines } from "../src/catalog/active-text.ts";
import { shippedLedger } from "../src/catalog/printed-ledger.ts";

import { loadCards } from "./data/load-cards.ts";
import { generateEffects } from "./data/effects/generate.ts";
import { lineTimings } from "./data/normalize/timings.ts";
import { isKeywordLine } from "./data/normalize/keywords.ts";
import { keyOf, lineId, loadLedger } from "./data/printed/ledger.ts";
import { isPoolCard, withPool } from "./data/printed/pool.ts";
import { PLAYER_REQUESTS } from "./data/printed/scope.ts";
import { openLines } from "./data/effects/open-lines.ts";
import { OPEN_LINES } from "../src/effects/open-lines.ts";
import { dealtCodes, loadCampaign, loadCampaigns, loadScenarios, nightmareCodes, starterCodes } from "./data/load-scenarios.ts";

// Every printed line of a card the Fellowship scenarios deal is owned: by an effect record that names it in
// `lines`, by a keyword the engine reads (a line that is only keywords), or by an `inert` entry in the printed-text
// ledger (data/printed). Every record names lines that exist and belong to its own card. A line no template reads
// is listed by `pnpm effects:draft` for an agent to author.
const cards = loadCards();
const scenarios = loadScenarios();
const campaign = loadCampaign();
const ledger = loadLedger();
// The box ledger plus the pool's lines (every deck-legal player card outside the box, from its source text).
const lines = withPool(ledger, cards);
const byCode = new Map(cards.map((card) => [card.code, card]));

// A scenario is playable when every printed line of the cards it deals is owned, its campaignPlaced cards (the boons
// 141044's Resolution attaches) included. Scenarios 1 to 3 are. Scenarios 4 to 6 are built (data/scenarios, with their
// campaign cards) and not yet playable: phases 14 to 16 write their records. The campaign cards' Setup and Resolution
// lines are owned for all six, which is the 8d exit. The list is src/campaign/playable.ts, which also gates standalone play.
const PENDING_LINES: Readonly<Record<string, string>> = {};
const campaignCards = new Set(Object.values(campaign.campaignCards));
// The player's requests (scripts/data/printed/scope.ts: The Shirefolk and the four core-set Learn to Play decks) are held to the
// same rule as the starter cards: every printed line owned.
// A scenario's Nightmare deck is held to the rule only once it is in NIGHTMARE_PLAYABLE (docs/plans/nightmare-mode.md).
const dealt = new Set([
  ...dealtCodes(campaign, scenarios.filter((scenario) => PLAYABLE.includes(scenario.id)), { nightmare: false }),
  ...nightmareCodes(scenarios.filter((scenario) => NIGHTMARE_PLAYABLE.includes(scenario.id))),
  ...campaignCards,
  ...starterCodes(campaign),
  ...PLAYER_REQUESTS,
]);
const unplayable = scenarios.filter((scenario) => !PLAYABLE.includes(scenario.id));
const nightmareUnplayable = scenarios.filter((scenario) => scenario.nightmare && !NIGHTMARE_PLAYABLE.includes(scenario.id));

// The printed lines of these cards that no record, keyword or inert mark owns.
function openOf(codes: Iterable<string>): string[] {
  return [...codes].flatMap((code) =>
    ledger.entries
      .filter((entry) => entry.code === code)
      .flatMap((entry) => entry.lines.map((line, at) => ({ id: lineId(code, entry.side, at + 1), line, entry })))
      .filter(({ id, line, entry }) => !EFFECTS.some((effect) => effect.lines.includes(id)) && !isKeywordLine(line) && !entry.inert.some((mark) => id.endsWith(`:${mark.line}`)))
      .map(({ id }) => id),
  );
}

describe("effect coverage", () => {
  for (const code of [...dealt].sort()) {
    const card = byCode.get(code);
    it(`${code} ${card?.name ?? "(not in data/cards)"} owns every printed line`, () => {
      expect(card, `${code} is in data/cards`).toBeDefined();
      const entries = ledger.entries.filter((entry) => entry.code === code);
      expect(entries.length, `${code} has a printed-text ledger entry`).toBeGreaterThan(0);
      for (const entry of entries) {
        entry.lines.forEach((line, at) => {
          const id = lineId(code, entry.side, at + 1);
          const owned = EFFECTS.some((effect) => effect.lines.includes(id)) || isKeywordLine(line) || entry.inert.some((mark) => mark.line === at + 1) || id in PENDING_LINES;
          expect(owned, `${id} is owned: ${line}`).toBe(true);
        });
      }
    });
  }

  it("keeps the scenarios that are not playable honest: each has a printed line nobody owns yet", () => {
    for (const scenario of unplayable) {
      const open = openOf([...dealtCodes(campaign, [scenario], { nightmare: false })].filter((code) => !campaignCards.has(code)));
      expect(open.length, `${scenario.id} would be playable: add it to PLAYABLE`).toBeGreaterThan(0);
    }
  });

  it("keeps NIGHTMARE_PLAYABLE honest: a playable scenario's Nightmare deck with every line owned is listed, and only a playable scenario is", () => {
    for (const id of NIGHTMARE_PLAYABLE) expect(PLAYABLE, `${id} is on NIGHTMARE_PLAYABLE but not playable`).toContain(id);
    for (const scenario of nightmareUnplayable.filter((item) => PLAYABLE.includes(item.id))) {
      // Every card of the deck is read (the printed-text test holds the ledger to its scope), so an unread card cannot hide an open line.
      const codes = [...nightmareCodes([scenario])];
      for (const code of codes) expect(ledger.entries.some((entry) => entry.code === code), `${code} is ledgered`).toBe(true);
      expect(openOf(codes).length, `${scenario.id} on Nightmare would be playable: add it to NIGHTMARE_PLAYABLE`).toBeGreaterThan(0);
    }
  });

  const lineOf = (id: string): string => {
    const [code, side, n] = id.split(":");
    return lines.byKey.get(keyOf(code ?? "", side ?? ""))?.lines[Number(n) - 1] ?? "";
  };

  it("has a record that names a line of its own card, for every shipped record", () => {
    for (const effect of EFFECTS) {
      expect(effect.lines.length, `${effect.id} names a line`).toBeGreaterThan(0);
      for (const id of effect.lines) {
        const [code, side, n] = id.split(":");
        const entry = lines.byKey.get(keyOf(code ?? "", side ?? ""));
        expect(code, `${effect.id} claims ${id}, a line of another card`).toBe(effect.cardCode);
        const line = entry?.lines[Number(n) - 1];
        expect(line, `${effect.id} claims ${id}, which is not a printed line`).toBeDefined();
        // A ledger edit that shifts line numbers moves a record onto a line with another label. A record may also own an
        // unlabeled line it carries out with its labeled one (Close Call's "Doomed X." raised by its Response, 08005).
        const timings = lineTimings(line ?? "");
        const alongside = timings.has("constant") && effect.lines.some((other) => other !== id && lineTimings(lineOf(other)).has(effect.timing));
        if (!alongside) expect(timings, `${effect.id} (${effect.timing}) claims ${id}: ${line}`).toContain(effect.timing);
      }
    }
  });

  it("backs each keyword-owned inert line with a keyword on its card", () => {
    for (const entry of ledger.entries) {
      for (const mark of entry.inert.filter((item) => item.keyword)) {
        const keywords = (byCode.get(entry.code)?.keywords ?? {}) as Record<string, unknown>;
        expect(keywords[mark.keyword ?? ""], `${entry.code}.${entry.side} line ${mark.line} names ${mark.keyword}`).toBeTruthy();
      }
    }
  });

  it("leaves no inert line that a record also claims", () => {
    for (const entry of ledger.entries) {
      for (const mark of entry.inert) {
        const id = lineId(entry.code, entry.side, mark.line);
        expect(EFFECTS.some((effect) => effect.lines.includes(id)), `${id} is inert and implemented`).toBe(false);
      }
    }
  });
});

describe("generated and authored records", () => {
  const regenerated = generateEffects(cards, scenarios, campaign, lines);
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

  it("match what the templates write today", () => {
    expect([...GENERATED_EFFECTS].sort(byId)).toEqual([...regenerated.effects].sort(byId));
  });

  it("list every printed line still without a record in open-lines.ts (pnpm effects:open rewrites it)", () => {
    // Every built campaign, as pnpm effects:open reads them: a campaign with XP also deals the Hard/Expert Mode card.
    expect(OPEN_LINES).toEqual(openLines(cards, lines, loadCampaigns(), scenarios, EFFECTS));
  });

  it("agree with the app's not-applied check on every pool card: it names the open lines, and no other", () => {
    const check = textCheck(EFFECTS, shippedLedger());
    const pool = cards.filter(isPoolCard);
    const fromApp = pool.flatMap((card) => unappliedLines(card.code, card.text, check, card.back?.text ?? null).map((line) => line.id ?? `${card.code}:?`));
    const poolCodes = new Set(pool.map((card) => card.code));
    expect(fromApp.sort()).toEqual(OPEN_LINES.filter((id) => poolCodes.has(id.split(":")[0] ?? "")).sort());
  });

  it("replace each other only where AUTHORED_REPLACES says so", () => {
    const generatedIds = new Set(GENERATED_EFFECTS.map((effect) => effect.id));
    const overlapping = AUTHORED_EFFECTS.filter((effect) => generatedIds.has(effect.id)).map((effect) => effect.id);
    expect([...overlapping].sort()).toEqual([...AUTHORED_REPLACES].sort());
    expect(new Set(EFFECTS.map((effect) => effect.id)).size).toBe(EFFECTS.length);
  });

  it("leave only authored records for the lines no template reads", () => {
    expect(regenerated.effects.length).toBeGreaterThan(30);
    for (const line of regenerated.unmatched.filter((item) => dealt.has(item.card.code))) {
      const [code, side, n] = line.lineId.split(":");
      const inert = ledger.byKey.get(keyOf(code ?? "", side ?? ""))?.inert.some((mark) => mark.line === Number(n)) ?? false;
      expect(inert || line.lineId in PENDING_LINES || EFFECTS.some((effect) => effect.lines.includes(line.lineId)), `${line.lineId} ${line.line}`).toBe(true);
    }
  });
});

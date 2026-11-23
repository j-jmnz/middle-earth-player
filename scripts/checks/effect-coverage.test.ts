import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NIGHTMARE_PLAYABLE, PLAYABLE_SCENARIOS as PLAYABLE } from "../../src/campaign/playable.ts";
import { AUTHORED_EFFECTS, AUTHORED_REPLACES, EFFECTS, GENERATED_EFFECTS } from "../../src/effects/index.ts";
import { textCheck, unappliedLines } from "../../src/catalog/active-text.ts";
import { shippedLedger } from "../../src/catalog/printed-ledger.ts";

import { loadCards } from "../data/load-cards.ts";
import { generateEffects } from "../data/effects/generate.ts";
import { lineTimings } from "../data/normalize/timings.ts";
import { isKeywordLine } from "../data/normalize/keywords.ts";
import { keyOf, lineId, loadLedger, printedLine } from "../data/printed/ledger.ts";
import { isPoolCard, withPool } from "../data/printed/pool.ts";
import { PLAYER_REQUESTS } from "../data/printed/scope.ts";
import { authoredFileNames, authoredOrder, renderAuthoredBarrel } from "../data/effects/barrel.ts";
import { ROOT } from "../data/paths.ts";
import { openLines } from "../data/effects/open-lines.ts";
import { OPEN_LINES } from "../../src/effects/open-lines.ts";
import { dealtCodes, loadCampaign, loadCampaigns, loadCampaignsInOrder, loadLedgeredScenarios, nightmareCodes, starterCodes } from "../data/load-scenarios.ts";

// Every printed line of a card the Fellowship scenarios deal is owned: by an effect record that names it in
// `lines`, by a keyword the engine reads (a line that is only keywords), or by an `inert` entry in the printed-text
// ledger (data/printed). Every record names lines that exist and belong to its own card. A line no template reads
// is listed by `pnpm effects draft` for an agent to author.
const cards = loadCards();
const scenarios = loadLedgeredScenarios();
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
// A scenario's Nightmare deck is held to the rule only once it is in NIGHTMARE_PLAYABLE (docs/scenarios/nightmare.md, Nightmare).
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

// The Campaign Setup of a Dream-chaser campaign card whose box prints no Setup line (The Thing in the Depths, 11194): the cards to set aside are the scenario's Campaign Setup rule (dcce.campaign-setup-*), and the
// record cites the card's "You are playing Campaign Mode." marker line, which has no other game effect.
// The Black Gate Opens' campaign card (146074) holds the flag endsInDefeat for the whole scenario by a constant record that cites its Resolution line: the scenario has no win, and its last player's elimination runs that Resolution (user decision, 2026-11-12).
// Fog on the Barrow-downs' stage 4B prints only Forced lines, so the flag holdsWin (its defeat does not win the game, the Forced line sends the player back to stage 3B) is a constant record citing the Forced line that says what the defeat does.
const isCampaignMarker = (effect: { cardCode: string; timing: string }, line: string): boolean =>
  (effect.cardCode === "11194" && effect.timing === "campaignSetup" && line === "You are playing Campaign Mode.") ||
  (effect.cardCode === "146074" && effect.timing === "constant" && line.startsWith("Resolution:")) ||
  (effect.cardCode === "148004" && effect.timing === "constant" && line.startsWith("Forced: After this stage is defeated"));

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

  // A seeded entry (`pnpm data ledger-seed`) has no reader until its lines are read against the scan.
  it("reads every ledger entry of a playable scenario's cards against its scan", () => {
    const unread = ledger.entries.filter((entry) => dealt.has(entry.code) && entry.readBy.trim() === "").map((entry) => keyOf(entry.code, entry.side));
    expect(unread).toEqual([]);
  });

  // A scenario with every line owned waits for PLAYABLE only until its golden is pinned: while golden.test.ts exists and golden.json does not
  // (the records are done and the game is being played), it may be absent; once golden.json exists it must be listed.
  const goldenPending = (id: string): boolean => {
    const dir = path.join(ROOT, "src", "campaign", "scenarios", id);
    return existsSync(path.join(dir, "golden.test.ts")) && !existsSync(path.join(dir, "golden.json"));
  };

  it("keeps the scenarios that are not playable honest: each has a printed line nobody owns yet, or a golden still to pin", () => {
    for (const scenario of unplayable) {
      const open = openOf([...dealtCodes(campaign, [scenario], { nightmare: false })].filter((code) => !campaignCards.has(code)));
      if (open.length === 0) expect(goldenPending(scenario.id), `${scenario.id} would be playable: add it to PLAYABLE (its golden.json exists)`).toBe(true);
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

  // A printed "Forced:" line that is a replacement effect ("When 3 or more damage would be placed on Revenant, place 2 damage instead") holds for as long as its card is in play, however
  // the card came into play, so a constant record owns it: a Forced trigger on one way in (added to the staging area, engaged) would miss the others. Named one by one, with the reason.
  // 05023:constant:1 is the other half of Harbor Storehouse's Forced line: the table flag that makes the engine announce a card that leaves the top of the encounter deck (families/stormcaller/zone.ts), held while the card is in play.
  const REPLACEMENT_RECORDS: ReadonlySet<string> = new Set(["11181:constant:2", "05023:constant:1"]);

  const lineOf = (id: string): string => printedLine(lines, id) ?? "";

  it("has a record that names a line of its own card, for every shipped record", () => {
    for (const effect of EFFECTS) {
      expect(effect.lines.length, `${effect.id} names a line`).toBeGreaterThan(0);
      for (const id of effect.lines) {
        const code = id.split(":")[0];
        expect(code, `${effect.id} claims ${id}, a line of another card`).toBe(effect.cardCode);
        const line = printedLine(lines, id);
        expect(line, `${effect.id} claims ${id}, which is not a printed line`).toBeDefined();
        // A ledger edit that shifts line numbers moves a record onto a line with another label. A record may also own an
        // unlabeled line it carries out with its labeled one (Close Call's "Doomed X." raised by its Response, 08005).
        const timings = lineTimings(line ?? "");
        const alongside = timings.has("constant") && effect.lines.some((other) => other !== id && lineTimings(lineOf(other)).has(effect.timing));
        if (!alongside && !REPLACEMENT_RECORDS.has(effect.id) && !isCampaignMarker(effect, line ?? "")) expect(timings, `${effect.id} (${effect.timing}) claims ${id}: ${line}`).toContain(effect.timing);
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
        expect(EFFECTS.some((effect) => effect.lines.includes(id) && !isCampaignMarker(effect, entry.lines[mark.line - 1] ?? "")), `${id} is inert and implemented`).toBe(false);
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

  it("are all in the barrel pnpm data build writes (src/effects/generated/authored.ts), in campaign order", () => {
    const authored = path.join(ROOT, "src", "effects", "authored");
    const fresh = renderAuthoredBarrel(authoredOrder(authoredFileNames(authored), loadCampaignsInOrder(), scenarios));
    expect(readFileSync(path.join(ROOT, "src", "effects", "generated", "authored.ts"), "utf8"), "run pnpm data build").toBe(fresh);
  });

  it("list every printed line still without a record in open-lines.ts (pnpm effects open rewrites it)", () => {
    // Every built campaign, as pnpm effects open reads them: a campaign with XP also deals the Hard/Expert Mode card.
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

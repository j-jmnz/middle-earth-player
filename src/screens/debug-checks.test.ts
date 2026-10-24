import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scenarioCards } from "../catalog/scenario-data.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { debugSentences, type DebugCheckInput, type DebugImageSample } from "./debug-checks.ts";

const scenario = loadScenario("a-shadow-of-the-past");
const campaign = loadCampaign();

const samples: DebugImageSample[] = [
  { code: "141001", imagesrc: "/bundles/cards/141001.png", width: 423, height: 600, mediaType: "image/jpeg" },
  { code: "141022", imagesrc: "/bundles/cards/141022.png", width: null, height: null, mediaType: null },
  { code: "141023", imagesrc: null, width: null, height: null, mediaType: null },
  { code: "141024", imagesrc: "/bundles/cards/141024.png", width: 100, height: 200, mediaType: "image/png" },
];

function base(overrides: Partial<DebugCheckInput> = {}): DebugCheckInput {
  return {
    bundledVersion: 2,
    appliedVersion: 2,
    packCount: 2,
    cardCount: 10,
    fellowship: { id: "fellowship-of-the-ring", name: "Fellowship of the Ring" },
    deckCount: 0,
    saveCount: 0,
    hero: { present: true, deckLegal: true, imagesrc: "/bundles/cards/141001.png" },
    scenario,
    campaign,
    presentCardCodes: [...new Set(scenarioCards(scenario).map((card) => card.code))],
    imageFileCount: 1,
    snapshotCount: 1,
    pauseEntryCount: 0,
    samples,
    scansPacked: false,
    queue: { pending: 0, active: 0, failures: {} },
    ...overrides,
  };
}

describe("debugSentences", () => {
  it("reports a matching catalog, hero, scenario join, and image sample", () => {
    expect(debugSentences(base())).toEqual([
      "Catalog 2 matches the user database.",
      "2 packs.",
      "10 cards.",
      "Fellowship campaign Fellowship of the Ring.",
      "0 decks.",
      "0 saves.",
      "Hero 141001 is present, deck-legal, and has an imagesrc.",
      "Normal encounter size is 40.",
      "A Shadow of the Past has 26 cards.",
      "Hunted has 6 cards.",
      "The Ring has 3 cards.",
      "The Black Riders has 5 cards.",
      "Stages are 141022, 141023, 141024.",
      "Setup instructions: 3. Resolution instructions: 2.",
      "1 image file.",
      "1 image in memory.",
      "0 pause entries.",
      "141001 is a 423×600 image/jpeg.",
      "141022 is not cached.",
      "141023 has no imagesrc.",
      "141024 is a 100×200 image/png.",
      "Scans are not packed.",
      "Queue has 0 pending and 0 active.",
    ]);
  });

  it("names a catalog version mismatch", () => {
    expect(debugSentences(base({ appliedVersion: 1 }))).toContain("Catalog 2 does not match user database 1.");
    expect(debugSentences(base({ appliedVersion: null }))).toContain(
      "User database has no applied catalog version. Bundled catalog is 2.",
    );
  });

  it("names a missing or illegal hero", () => {
    expect(debugSentences(base({ hero: { present: false, deckLegal: true, imagesrc: "/x" } }))).toContain(
      "Hero 141001 is missing.",
    );
    const illegal = debugSentences(base({ hero: { present: true, deckLegal: false, imagesrc: "  " } }));
    expect(illegal).toContain("Hero 141001 is not deck-legal.");
    expect(illegal).toContain("Hero 141001 has no imagesrc.");
    expect(illegal).not.toContain("Hero 141001 is present, deck-legal, and has an imagesrc.");
  });

  it("names a scenario card that is absent from cards", () => {
    const present = base().presentCardCodes.filter((code) => code !== "141031");
    expect(debugSentences(base({ presentCardCodes: present }))).toContain("Scenario code 141031 is absent from cards.");
  });

  it("names an image that is missing, unpacked, or failed", () => {
    const empty = debugSentences(
      base({
        samples: [{ code: "141001", imagesrc: "", width: 423, height: 600, mediaType: "image/jpeg" }],
        scansPacked: true,
        queue: { pending: 2, active: 1, failures: { "141001": "HTTP status 503" } },
      }),
    );
    expect(empty).toContain("141001 has no imagesrc.");
    expect(empty).not.toContain("141001 is a 423×600 image/jpeg.");
    expect(empty).toContain("Scans are packed.");
    expect(empty).toContain("Queue has 2 pending and 1 active.");
    expect(empty).toContain("141001 failed: HTTP status 503.");
  });

  it("does not select card text or errata from the debug route", () => {
    const source = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "routes/debug.tsx"),
      "utf8",
    );
    expect(source).not.toContain("cards.text");
    expect(source).not.toContain("cards.errata");
  });
});

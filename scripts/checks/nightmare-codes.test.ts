import { describe, expect, it } from "vitest";

import { placementsAt } from "../../src/catalog/scenario-data.ts";
import { NIGHTMARE_PLAYABLE } from "../../src/campaign/playable.ts";
import { EFFECTS } from "../../src/effects/index.ts";

import { loadCards } from "../data/load-cards.ts";
import { loadScenarios } from "../data/load-scenarios.ts";

// On Nightmare the setup card's recipe can replace a scenario card by a Nightmare card of the same title (docs/plans/done/nightmare-mode.md). A
// record that names a scenario card by code (set it aside, add it to the staging area, search for it, "while it is in play") reads the
// card of that title the game dealt (twinCode, src/rules/families/nightmare/index.ts). So for each scenario on NIGHTMARE_PLAYABLE, every
// scenario card a dealt card's record names is dealt on Nightmare, itself or a card with its title.
const cards = new Map(loadCards().map((card) => [card.code, card]));
const scenarios = loadScenarios();

function namedCodes(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const entry of value) namedCodes(entry, found);
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "code" && typeof entry === "string") found.add(entry);
      else namedCodes(entry, found);
    }
  }
  return found;
}

describe("Nightmare deals every scenario card a record names (twinCode)", () => {
  for (const id of NIGHTMARE_PLAYABLE) {
    it(id, () => {
      const scenario = scenarios.find((entry) => entry.id === id);
      const nightmare = scenario?.nightmare;
      if (!scenario || !nightmare) throw new Error(`${id} has no Nightmare deck`);
      const dealt = new Set([...placementsAt(scenario, "Nightmare").map((card) => card.code), scenario.campaignCard, ...scenario.campaignPlaced, nightmare.setupCard]);
      const titles = new Set([...dealt].map((code) => cards.get(code)?.name));
      const standard = new Set(scenario.cards.map((card) => card.code));
      const missing: string[] = [];
      for (const effect of EFFECTS.filter((record) => dealt.has(record.cardCode))) {
        for (const code of namedCodes([effect.instructions, effect.condition ?? null])) {
          if (!standard.has(code) || dealt.has(code) || titles.has(cards.get(code)?.name)) continue;
          missing.push(`${effect.id} names ${code} (${cards.get(code)?.name ?? "?"})`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});

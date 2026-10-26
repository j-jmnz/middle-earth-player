import { writeFileSync } from "node:fs";
import path from "node:path";

import { EFFECTS } from "../../../src/effects/index.ts";
import { runScript, type Log } from "../../log.ts";
import { loadCards } from "../load-cards.ts";
import { loadCampaign, loadScenarios } from "../load-scenarios.ts";
import { ROOT } from "../paths.ts";
import { loadLedger } from "../printed/ledger.ts";
import { withPool } from "../printed/pool.ts";
import { openLines, renderOpenLines } from "./open-lines.ts";

// Usage: pnpm effects:open. Rewrites src/effects/open-lines.ts after records are added or changed.
function main(log: Log): void {
  const cards = loadCards();
  const open = openLines(cards, withPool(loadLedger(), cards), loadCampaign(), loadScenarios(), EFFECTS);
  writeFileSync(path.join(ROOT, "src", "effects", "open-lines.ts"), renderOpenLines(open));
  log.info(`${open.length} open lines on ${new Set(open.map((id) => id.split(":")[0])).size} cards`);
}

void runScript("effects:open", main);

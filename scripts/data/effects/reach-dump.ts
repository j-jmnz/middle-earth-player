import { writeFileSync } from "node:fs";

import { EFFECTS } from "../../../src/effects/index.ts";
import { PLAYABLE_SCENARIOS } from "../../../src/campaign/playable.ts";
import { createLog } from "../../log.ts";
import { loadCards } from "../load-cards.ts";
import { dealtCodes, loadAnyScenario, loadCampaigns } from "../load-scenarios.ts";
import { keyOf } from "../printed/ledger.ts";
import { loadRenderEnv, renderCodes } from "./render/scenario.ts";
import type { CardDump, Dump } from "./reach-diff.ts";

// Run by `pnpm effects reach` (reach.ts) in the working tree and in a checkout of the base ref: writes, for every card that has records and is dealt by a playable scenario or
// is a deck-legal player card, the render `pnpm effects render` prints for it and the JSON of its records. Usage: node reach-dump.ts <out.json>
// It lives in the working tree and is copied into the base checkout, so it uses only what the render itself uses.

const PLAYER_TYPES = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract"]);

function main(): void {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: reach-dump.ts <out.json>");
  const env = loadRenderEnv();
  const campaigns = loadCampaigns();
  const dealt = new Set<string>();
  for (const id of PLAYABLE_SCENARIOS) for (const code of dealtCodes(campaigns, [loadAnyScenario(id)])) dealt.add(code);
  for (const card of loadCards()) if (PLAYER_TYPES.has(card.type) && card.deckLegal) dealt.add(card.code);
  const byCode = new Map<string, Record<string, unknown>>();
  for (const effect of EFFECTS) {
    const records = byCode.get(effect.cardCode) ?? {};
    records[effect.id] = effect;
    byCode.set(effect.cardCode, records);
  }
  const cards: Record<string, CardDump> = {};
  for (const code of [...dealt].sort()) {
    const records = byCode.get(code);
    const card = env.byCode.get(code);
    if (!records || !card) continue;
    const lines: Record<string, string> = {};
    for (const side of ["A", "B"] as const) (env.ledger.byKey.get(keyOf(code, side))?.lines ?? []).forEach((line, at) => (lines[`${code}:${side}:${at + 1}`] = line));
    cards[code] = { name: card.name, lines, text: renderCodes(env, [code]).text.replace(/\n\n\(rendered pieces: .*\)\n$/, ""), records };
  }
  const dump: Dump = { cards };
  writeFileSync(out, JSON.stringify(dump));
  createLog("effects:reach").info(`dumped ${Object.keys(cards).length} cards to ${out}`);
}

main();

// Rules: rr.guarded (data/rules/entries.json); ledger lines 01108:A:3, 01109:A:3, 01110:A:3 (Escape from Dol Guldur).
//
// What a claimed objective does to the hero that carries it, in the card's own words: the printed lines after its claim Action ("Forced: At the end of each round, attached hero suffers 1 damage."),
// read from the ledger so the claim prompt names the lasting effect. Empty for a card with none.
import { ledgerLine } from "../cards/ledger.ts";

export function claimedEffectWords(code: string): string {
  const found: string[] = [];
  let claim = false;
  for (let at = 1; ; at += 1) {
    const line = ledgerLine(`${code}:A:${at}`);
    if (line == null) break;
    if (claim) found.push(line);
    else if (line.startsWith("Action:") && /claim this objective/i.test(line)) claim = true;
  }
  return found.join(" ");
}

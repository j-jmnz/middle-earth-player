// The printed-text ledger the app ships (data/printed): each card side's ability lines as read from its scan, and the lines
// that need no record. The table's causes, the "not applied" check and the card screens read it from here.
import printed from "../../data/printed/fellowship-of-the-ring.json";

import { ledgerByCode, type Ledger, type PrintedSide } from "./active-text.ts";

let byCode: Ledger | null = null;

/** The shipped ledger by card code. */
export function shippedLedger(): Ledger {
  byCode ??= ledgerByCode((printed as { entries: PrintedSide[] }).entries);
  return byCode;
}

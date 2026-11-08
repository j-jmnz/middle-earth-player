// The printed-text ledger the app ships (data/printed, every campaign's file): each card side's ability lines as read from its scan, and the lines
// that need no record. The table's causes, the "not applied" check and the card screens read it from here.
import dreamChaser from "../../data/printed/dream-chaser.json";
import eredMithrin from "../../data/printed/ered-mithrin.json";
import fellowship from "../../data/printed/fellowship-of-the-ring.json";
import mirkwood from "../../data/printed/mirkwood-paths.json";
import twoTowers from "../../data/printed/the-two-towers.json";

import { ledgerByCode, type Ledger, type PrintedSide } from "./active-text.ts";

let byCode: Ledger | null = null;

/** The shipped ledger by card code. */
export function shippedLedger(): Ledger {
  byCode ??= ledgerByCode([...(fellowship as { entries: PrintedSide[] }).entries, ...(mirkwood as { entries: PrintedSide[] }).entries, ...(dreamChaser as { entries: PrintedSide[] }).entries, ...(eredMithrin as { entries: PrintedSide[] }).entries, ...(twoTowers as { entries: PrintedSide[] }).entries]);
  return byCode;
}

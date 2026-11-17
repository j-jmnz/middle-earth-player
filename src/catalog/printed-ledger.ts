// The printed-text ledger the app ships (data/printed, every campaign's file): each card side's ability lines as read from its scan, and the lines
// that need no record. The table's causes, the "not applied" check and the card screens read it from here.
import angmarAwakened from "../../data/printed/angmar-awakened.json";
import dreamChaser from "../../data/printed/dream-chaser.json";
import dwarrowdelf from "../../data/printed/dwarrowdelf.json";
import eredMithrin from "../../data/printed/ered-mithrin.json";
import fellowship from "../../data/printed/fellowship-of-the-ring.json";
import mirkwood from "../../data/printed/mirkwood-paths.json";
import shadowsOfMirkwood from "../../data/printed/shadows-of-mirkwood.json";
import returnOfTheKing from "../../data/printed/the-return-of-the-king.json";
import twoTowers from "../../data/printed/the-two-towers.json";

import { ledgerByCode, type Ledger, type PrintedSide } from "./active-text.ts";

let byCode: Ledger | null = null;

/** The shipped ledger by card code. */
export function shippedLedger(): Ledger {
  byCode ??= ledgerByCode([...(angmarAwakened as { entries: PrintedSide[] }).entries, ...(fellowship as { entries: PrintedSide[] }).entries, ...(mirkwood as { entries: PrintedSide[] }).entries, ...(dreamChaser as { entries: PrintedSide[] }).entries, ...(eredMithrin as { entries: PrintedSide[] }).entries, ...(twoTowers as { entries: PrintedSide[] }).entries, ...(returnOfTheKing as { entries: PrintedSide[] }).entries, ...(shadowsOfMirkwood as { entries: PrintedSide[] }).entries, ...(dwarrowdelf as { entries: PrintedSide[] }).entries]);
  return byCode;
}

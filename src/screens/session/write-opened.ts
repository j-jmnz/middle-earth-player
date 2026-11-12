// The one write an open makes, once for each session the table's hook holds (write-once.ts): a drop (the open scenario or game does not read), or the stamp of a
// game that was current (the world, the checks). The hooks run it in an effect, never during a render. Pure of React.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { writeActive, writeSave } from "../data/campaign-store";
import { writeStandalone, writeStandaloneActive } from "../data/standalone-store";
import type { StandaloneSession } from "./standalone-open";
import type { TableSession } from "./table-open";
import { writeOnce } from "./write-once";

export function writeOpenedTable<TUser>(user: BaseSQLiteDatabase<"sync", TUser>, session: TableSession | null): void {
  writeOnce(session, (opened) => {
    if (opened.ok) {
      if (opened.stamp) writeActive(user, opened.stamp);
    } else if (opened.write) writeSave(user, opened.write);
  });
}

export function writeOpenedStandalone<TUser>(user: BaseSQLiteDatabase<"sync", TUser>, session: StandaloneSession | null): void {
  writeOnce(session, (opened) => {
    if (opened.ok) {
      if (opened.stamp) writeStandaloneActive(user, opened.stamp);
    } else if (opened.write) writeStandalone(user, opened.write);
  });
}

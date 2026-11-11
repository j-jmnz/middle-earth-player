import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { CATALOG_VERSION, catalogFileIsCurrent, shouldReplaceCatalog } from "../../catalog/version";
import migrations from "../../../drizzle/migrations";
import { writeAppliedCatalogVersion } from "./applied-catalog-version";
import { boxOf } from "./campaign-data";
import { catalogAssetModule } from "./catalog-asset";
import { backfillRunTable } from "./run-store";
import { meta } from "./user-schema";

function catalogAssetModuleId(): number {
  // Native require() returns a number. Web returns a URL string, which
  // Asset.fromModule accepts. expo-sqlite types only the number.
  return catalogAssetModule(require("../../../assets/catalog.db")) as number;
}

export type AppDatabases = {
  catalog: ExpoSQLiteDatabase;
  user: ExpoSQLiteDatabase;
};

async function openCatalog(forceOverwrite: boolean): Promise<SQLiteDatabase> {
  await importDatabaseFromAssetAsync("catalog.db", { assetId: catalogAssetModuleId(), forceOverwrite });
  return openDatabaseAsync("catalog.db");
}

async function stampOf(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? null;
}

let opening: Promise<AppDatabases> | null = null;

export function openDatabases(): Promise<AppDatabases> {
  opening ??= openDatabasesOnce();
  return opening;
}

async function openDatabasesOnce(): Promise<AppDatabases> {
  const userSqlite = await openDatabaseAsync("user.db");
  const user = drizzle(userSqlite);
  await migrate(user, migrations);
  try {
    // The runs the store already knew when the table was added (once; run-store.ts).
    backfillRunTable(user, (id) => boxOf(id)?.id ?? null);
  } catch (error: unknown) {
    console.warn(`Run history was not back-filled (${error instanceof Error ? error.message : "unknown error"}); it is tried again at the next launch`);
  }

  const stored = user
    .select({ appliedCatalogVersion: meta.appliedCatalogVersion })
    .from(meta)
    .get();
  const applied = stored?.appliedCatalogVersion ?? null;
  const replaceCatalog = shouldReplaceCatalog(CATALOG_VERSION, applied);

  let catalogSqlite = await openCatalog(replaceCatalog);
  let replaced = replaceCatalog;
  // The applied version in user.db names what the code expected, not what the file holds: a build that shipped a stale
  // catalog.db recorded the right number over the wrong rows. The file's own stamp settles it (version.ts).
  if (!catalogFileIsCurrent(await stampOf(catalogSqlite), CATALOG_VERSION)) {
    await catalogSqlite.closeAsync();
    catalogSqlite = await openCatalog(true);
    replaced = true;
    if (!catalogFileIsCurrent(await stampOf(catalogSqlite), CATALOG_VERSION)) {
      console.warn("The bundled catalog.db does not match this build's CATALOG_VERSION: run pnpm assets catalog and rebuild");
    }
  }
  await catalogSqlite.execAsync("PRAGMA query_only = ON");

  if (replaced) {
    writeAppliedCatalogVersion((statement) => {
      userSqlite.execSync(statement);
    }, CATALOG_VERSION);
  }

  return {
    catalog: drizzle(catalogSqlite),
    user,
  };
}

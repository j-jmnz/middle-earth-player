import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { importDatabaseFromAssetAsync, openDatabaseAsync } from "expo-sqlite";

import { CATALOG_VERSION, shouldReplaceCatalog } from "../catalog/version";
import migrations from "../../drizzle/migrations";
import { writeAppliedCatalogVersion } from "./applied-catalog-version";
import { catalogAssetModule } from "./catalog-asset";
import { meta } from "./user-schema";

function catalogAssetModuleId(): number {
  // Native require() returns a number. Web returns a URL string, which
  // Asset.fromModule accepts. expo-sqlite types only the number.
  return catalogAssetModule(require("../../assets/catalog.db")) as number;
}

export type AppDatabases = {
  catalog: ExpoSQLiteDatabase;
  user: ExpoSQLiteDatabase;
};

let opening: Promise<AppDatabases> | null = null;

export function openDatabases(): Promise<AppDatabases> {
  opening ??= openDatabasesOnce();
  return opening;
}

async function openDatabasesOnce(): Promise<AppDatabases> {
  const userSqlite = await openDatabaseAsync("user.db");
  const user = drizzle(userSqlite);
  await migrate(user, migrations);

  const stored = user
    .select({ appliedCatalogVersion: meta.appliedCatalogVersion })
    .from(meta)
    .get();
  const applied = stored?.appliedCatalogVersion ?? null;
  const replaceCatalog = shouldReplaceCatalog(CATALOG_VERSION, applied);

  await importDatabaseFromAssetAsync("catalog.db", {
    assetId: catalogAssetModuleId(),
    forceOverwrite: replaceCatalog,
  });

  const catalogSqlite = await openDatabaseAsync("catalog.db");
  await catalogSqlite.execAsync("PRAGMA query_only = ON");

  if (replaceCatalog) {
    writeAppliedCatalogVersion((statement) => {
      userSqlite.execSync(statement);
    }, CATALOG_VERSION);
  }

  return {
    catalog: drizzle(catalogSqlite),
    user,
  };
}

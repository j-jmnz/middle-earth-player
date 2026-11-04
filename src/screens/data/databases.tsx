import { createContext, useContext, type ReactNode } from "react";

import type { AppDatabases } from "./open-databases";

const DatabaseContext = createContext<AppDatabases | null>(null);

export function DatabaseProvider({
  databases,
  children,
}: {
  databases: AppDatabases;
  children: ReactNode;
}) {
  return <DatabaseContext.Provider value={databases}>{children}</DatabaseContext.Provider>;
}

export function useDatabases(): AppDatabases {
  const databases = useContext(DatabaseContext);
  if (!databases) {
    throw new Error("Databases are not open");
  }
  return databases;
}

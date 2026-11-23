// The web's and the desktop's open (open-databases.ts is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only). The desktop
// and the browser dev build open as the phone does (the phone file is asked for by another spelling than databases.tsx uses: scripts/checks/web-copies.test.ts). The web app's build keeps both databases in memory and copies user.db to storage (web/memory-databases.ts).
import { openDatabases as openOnDisk, type AppDatabases } from "../data/open-databases";
import { webAppBuild } from "../nav/webapp";
import { openInMemory } from "./web/memory-databases";

export type { AppDatabases };

let opening: Promise<AppDatabases> | null = null;

export function openDatabases(): Promise<AppDatabases> {
  opening ??= webAppBuild() ? openInMemory() : openOnDisk();
  return opening;
}

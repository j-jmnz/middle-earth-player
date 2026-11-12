import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { CampaignData, ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { AUTHORED_CAMPAIGN_FOLDERS } from "./authored-paths.ts";

// The barrel of the authored effect files (src/effects/generated/authored.ts). Metro cannot glob, so pnpm data build lists
// them. A top-level file of src/effects/authored/ that exports AUTHORED_EFFECTS is named for a campaign (its box's cards) or
// a scenario (its records). The merge order is the order the engine resolves records in: for each campaign in data/campaigns
// order, its own file and then its scenarios' files (a scenario in two campaigns counts once), then the scenarios no campaign
// lists, then the three folders that follow. A file named for neither fails the build. A campaign's own folder (AUTHORED_CAMPAIGN_FOLDERS) holds
// its box's file and its scenarios' files; a name here is the path under src/effects/authored/ without the extension.
const FOLDERS = [
  { exports: ["NIGHTMARE_AUTHORED_EFFECTS", "NIGHTMARE_AUTHORED_REPLACES"], from: "nightmare/index.ts" },
  { exports: ["POOL_AUTHORED_EFFECTS", "POOL_AUTHORED_REPLACES"], from: "pool/index.ts" },
  { exports: ["FAMILY_AUTHORED_EFFECTS", "FAMILY_AUTHORED_REPLACES"], from: "families/index.ts" },
] as const;

export function authoredFileNames(dir: string): string[] {
  const holders = ["", ...Object.values(AUTHORED_CAMPAIGN_FOLDERS)];
  return holders
    .flatMap((folder) =>
      readdirSync(path.join(dir, folder), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"))
        .filter((entry) => /export const AUTHORED_EFFECTS\b/.test(readFileSync(path.join(dir, folder, entry.name), "utf8")))
        .map((entry) => (folder ? `${folder}/` : "") + entry.name.slice(0, -3)),
    )
    .sort();
}

export function authoredOrder(names: readonly string[], campaigns: readonly Pick<CampaignData, "id" | "scenarios">[], scenarios: readonly Pick<ScenarioData, "id">[]): string[] {
  const byBase = new Map(names.map((name) => [name.slice(name.lastIndexOf("/") + 1), name]));
  const order: string[] = [];
  const take = (base: string) => {
    const name = byBase.get(base);
    if (name !== undefined && !order.includes(name)) order.push(name);
  };
  for (const campaign of campaigns) {
    take(campaign.id);
    for (const id of campaign.scenarios) take(id);
  }
  for (const scenario of scenarios) take(scenario.id);
  const unknown = names.filter((name) => !order.includes(name));
  if (unknown.length > 0) throw new Error(`src/effects/authored/${unknown.join(".ts, ")}.ts is named for no campaign or scenario in data/: rename it to a scenario id, or fold it into a folder with an index.ts`);
  return order;
}

export function renderAuthoredBarrel(order: readonly string[]): string {
  const ident = (name: string) => name.slice(name.lastIndexOf("/") + 1).toUpperCase().replaceAll("-", "_");
  const imports = order.map((name) => `import { AUTHORED_EFFECTS as ${ident(name)}_EFFECTS, AUTHORED_REPLACES as ${ident(name)}_REPLACES } from "../authored/${name}.ts";`);
  const folders = FOLDERS.map((folder) => `import { ${folder.exports.join(", ")} } from "../authored/${folder.from}";`);
  const effects = [...order.map((name) => `...${ident(name)}_EFFECTS`), ...FOLDERS.map((folder) => `...${folder.exports[0]}`)];
  const replaces = [...order.map((name) => `...${ident(name)}_REPLACES`), ...FOLDERS.map((folder) => `...${folder.exports[1]}`)];
  return [
    `import type { Effect } from "../../catalog/boundary.ts";`,
    ``,
    ...imports,
    ...folders,
    ``,
    `// Written by pnpm data build from src/effects/authored/ and data/campaigns (scripts/data/effects/barrel.ts). Do not edit.`,
    `// The merge order is the engine's resolution order: the campaigns' files in campaign order, then nightmare, pool and families.`,
    `export const AUTHORED_EFFECTS: readonly Effect[] = [${effects.join(", ")}];`,
    `export const AUTHORED_REPLACES: readonly string[] = [${replaces.join(", ")}];`,
    ``,
  ].join("\n");
}

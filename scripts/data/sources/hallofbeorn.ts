import { z } from "zod";

import { bytes, createLog, type Log } from "../../log.ts";
import { BUILT_SCENARIO_PRODUCTS, isBuiltScenario } from "../campaign-defs.ts";
import { combinedPin, fetchText, writeRaw, type SourceFile, type SourceRecord } from "./fetch.ts";

const BASE = "https://hallofbeorn.com/Export";
// The products whose scenarios some built campaign plays (scripts/data/campaign-defs.ts).
const TIMEOUT_MS = 120_000;

const sideSchema = z.object({
  Stats: z.record(z.string(), z.string().nullable()),
  Traits: z.array(z.string()),
  Keywords: z.array(z.string()),
  Text: z.array(z.string()),
  Shadow: z.string().nullable(),
  ImagePath: z.string().nullable(),
});

// Only the fields the normalizer reads. Unknown fields pass through in the raw snapshot.
export const hobCardSchema = z.object({
  Title: z.string(),
  Slug: z.string(),
  IsUnique: z.boolean(),
  CardType: z.string(),
  CardSubType: z.string().nullable().optional(),
  Sphere: z.string().nullable(),
  Front: sideSchema,
  Back: sideSchema.nullable(),
  CardSet: z.string(),
  EncounterInfo: z
    .object({
      EncounterSet: z.string().nullable(),
      EasyModeQuantity: z.number().nullable(),
      IncludedEncounterSets: z.array(z.string()),
      StageNumber: z.number().nullable(),
      StageLetter: z.string().nullable(),
    })
    .nullable(),
  Number: z.number(),
  Quantity: z.number(),
  HasErrata: z.boolean(),
  OctgnGuid: z.string().nullable(),
  RingsDbCardId: z.string().nullable(),
});
export type HobCard = z.infer<typeof hobCardSchema>;

export const hobScenarioIndexSchema = z.array(z.object({ Title: z.string(), Slug: z.string(), Product: z.string(), Number: z.number() }));

export const hobScenarioSchema = z.object({
  Title: z.string(),
  Slug: z.string(),
  Product: z.string(),
  Number: z.number(),
  QuestCards: z.array(hobCardSchema),
  // Per-scenario card counts for each difficulty. The title and slug name a TBR or RD printing.
  ScenarioCards: z.array(
    z.object({
      EncounterSet: z.string().nullable(),
      Title: z.string(),
      Slug: z.string(),
      NormalQuantity: z.number(),
      EasyQuantity: z.number(),
      NightmareQuantity: z.number(),
    }),
  ),
});

async function snapshot(relative: string, endpoint: string, files: SourceFile[], log: Log): Promise<string> {
  const url = `${BASE}/${endpoint}`;
  const body = await fetchText(url, TIMEOUT_MS, log);
  files.push(writeRaw(`hallofbeorn/${relative}`, url, body));
  return body;
}

// Parses a snapshot against its schema; a mismatch names the file and the first few paths that did not fit.
function checked<T>(schema: z.ZodType<T>, body: string, what: string): T {
  const result = schema.safeParse(JSON.parse(body));
  if (result.success) return result.data;
  const issues = result.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
  throw new Error(`Hall of Beorn ${what} no longer matches the schema (${result.error.issues.length} issue${result.error.issues.length === 1 ? "" : "s"}):\n  ${issues.join("\n  ")}`);
}

export async function syncHallOfBeorn(log: Log = createLog("hallofbeorn")): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  for (const kind of ["EncounterCards", "QuestCards", "PlayerCards"]) {
    const body = await snapshot(`${kind}.json`, kind, files, log);
    const cards = checked(z.array(hobCardSchema), body, kind);
    log.info(`${kind}: ${cards.length} cards, ${bytes(body.length)}`);
  }
  const indexBody = await snapshot("Scenarios.json", "Scenarios", files, log);
  const index = checked(hobScenarioIndexSchema, indexBody, "Scenarios");
  const wanted = index.filter(isBuiltScenario);
  log.info(`Scenarios: ${index.length} listed, ${wanted.length} from ${[...BUILT_SCENARIO_PRODUCTS].join(", ")}`);
  const tick = log.progress(wanted.length, "scenario");
  for (const entry of wanted) {
    const body = await snapshot(`Scenarios/${entry.Slug}.json`, `Scenarios/${entry.Slug}`, files, log);
    const scenario = checked(hobScenarioSchema, body, `scenario ${entry.Slug}`);
    tick(`${entry.Title}: ${scenario.ScenarioCards.length} card rows`);
  }
  return { id: "hallofbeorn", site: "https://hallofbeorn.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}

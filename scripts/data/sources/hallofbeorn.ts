import { z } from "zod";

import { combinedPin, fetchText, writeRaw, type SourceFile, type SourceRecord } from "./fetch.ts";

const BASE = "https://hallofbeorn.com/Export";
// Products whose scenarios the Fellowship campaign plays.
const FELLOWSHIP_PRODUCTS = new Set(["The Black Riders", "The Road Darkens"]);
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

async function snapshot(relative: string, endpoint: string, files: SourceFile[]): Promise<string> {
  const url = `${BASE}/${endpoint}`;
  const body = await fetchText(url, TIMEOUT_MS);
  files.push(writeRaw(`hallofbeorn/${relative}`, url, body));
  return body;
}

export async function syncHallOfBeorn(): Promise<SourceRecord> {
  const files: SourceFile[] = [];
  for (const kind of ["EncounterCards", "QuestCards", "PlayerCards"]) {
    const body = await snapshot(`${kind}.json`, kind, files);
    z.array(hobCardSchema).parse(JSON.parse(body));
  }
  const indexBody = await snapshot("Scenarios.json", "Scenarios", files);
  const index = hobScenarioIndexSchema.parse(JSON.parse(indexBody));
  for (const entry of index.filter((item) => FELLOWSHIP_PRODUCTS.has(item.Product))) {
    const body = await snapshot(`Scenarios/${entry.Slug}.json`, `Scenarios/${entry.Slug}`, files);
    hobScenarioSchema.parse(JSON.parse(body));
  }
  return { id: "hallofbeorn", site: "https://hallofbeorn.com", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}

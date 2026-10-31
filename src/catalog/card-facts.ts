import { z } from "zod";

import { printedKeywordsSchema } from "./boundary.ts";

// One card as data/cards stores it. The sync adapters feed it, scripts/data/normalize/ builds it, and
// the engine reads the subset it needs through src/rules/printed.ts.
export const printingSchema = z.strictObject({
  pack: z.string().min(1),
  number: z.number().int(),
  hobSlug: z.string().optional(),
  octgnGuid: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export const cardSchema = z.strictObject({
  code: z.string().min(1),
  name: z.string(),
  type: z.string().min(1),
  typeName: z.string(),
  sphere: z.string().nullable(),
  traits: z.array(z.string()),
  isUnique: z.boolean(),
  // A printed number, or "X". Null when the card has no cost.
  cost: z.string().nullable(),
  deckLimit: z.number().int().nullable(),
  threat: z.number().int().nullable(),
  willpower: z.number().int().nullable(),
  attack: z.number().int().nullable(),
  defense: z.number().int().nullable(),
  health: z.number().int().nullable(),
  questPoints: z.number().int().nullable(),
  victory: z.number().int().nullable(),
  engagementCost: z.number().int().nullable(),
  quantity: z.number().int(),
  easyQuantity: z.number().int().nullable(),
  encounterSet: z.string().nullable(),
  stage: z.string().nullable(),
  // Null when nobody has read the card's keywords. An empty object means it prints none.
  keywords: printedKeywordsSchema.nullable(),
  // Printed timing labels in text order. A label repeats when the card prints it twice.
  timings: z.array(z.string()),
  text: z.string().nullable(),
  shadowText: z.string().nullable(),
  // A boon or burden card (Campaign Mode), from the card's type bar. A burden belongs to a burden set, which is
  // printed where an encounter set icon would be; later campaign cards remove burdens by burden set.
  campaignKind: z.enum(["boon", "burden"]).nullable(),
  burdenSet: z.string().nullable(),
  // Which deck the card goes back to when it joins the campaign pool: a player card to a player deck, an
  // encounter card to the encounter deck. Null for quest, campaign and nightmare cards.
  backType: z.enum(["player", "encounter"]).nullable(),
  hasErrata: z.boolean(),
  // RingsDB prints the errata line in place of the text. Null when the card has none.
  errata: z.string().nullable(),
  // RingsDB's image path. Null for cards RingsDB does not have.
  imagesrc: z.string().nullable(),
  deckLegal: z.boolean(),
  // The side B of a quest or a double-sided card.
  back: z
    .strictObject({
      name: z.string().nullable(),
      text: z.string().nullable(),
      questPoints: z.number().int().nullable(),
      stage: z.string().nullable(),
      // The stats the Upgraded side of a ship-objective prints (dcce.scalable-upgradable); absent on any other side.
      willpower: z.number().int().optional(),
      attack: z.number().int().optional(),
      defense: z.number().int().optional(),
      health: z.number().int().optional(),
      // The Victory the Campaign Mode only side of the Stormcaller prints (15; side A prints 10): the score counts the side the card was on (dcce.campaign-mode).
      victory: z.number().int().optional(),
    })
    .nullable(),
  printings: z.array(printingSchema).min(1),
});

export type Card = z.infer<typeof cardSchema>;
export type Printing = z.infer<typeof printingSchema>;

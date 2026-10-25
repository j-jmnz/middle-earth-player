import { z } from "zod";

// One rule span of data/rules/entries.json: `pnpm data:build` cuts it out of its PDF column from the hand-checked quotes in
// data/rules/index.json (scripts/data/rules/spans.ts). `page` is the PDF page, the page the booklet reader opens on.
export const ruleEntrySchema = z.strictObject({
  id: z.string().min(1),
  doc: z.string().min(1),
  page: z.number().int().positive(),
  column: z.number().int().positive(),
  title: z.string().min(1),
  text: z.string(),
  terms: z.array(z.string().min(1)),
});

export type RuleEntry = z.infer<typeof ruleEntrySchema>;

export const ruleEntriesSchema = z.array(ruleEntrySchema);

/** entries.json as read at the app's boundary: parsed, so a malformed build fails on load and not in a screen. */
export function parseRuleEntries(value: unknown): RuleEntry[] {
  return ruleEntriesSchema.parse(value);
}

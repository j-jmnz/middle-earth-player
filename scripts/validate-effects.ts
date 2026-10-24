import { effectSchema, type Effect } from "../src/catalog/boundary.ts";

// The build is the only production writer of the effects table. A record that fails the schema, or an id
// used twice, stops the build.
export function validateEffects(records: readonly Effect[]): Effect[] {
  const seen = new Set<string>();
  return records.map((record) => {
    const parsed = effectSchema.safeParse(record);
    if (!parsed.success) {
      const id = typeof record?.id === "string" ? record.id : "(missing id)";
      throw new Error(`Effect ${id}: invalid at ${parsed.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ")}`);
    }
    if (seen.has(parsed.data.id)) throw new Error(`Effect id ${parsed.data.id} is used twice`);
    seen.add(parsed.data.id);
    return parsed.data;
  });
}

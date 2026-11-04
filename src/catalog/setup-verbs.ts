// The verbs of each setup role (src/catalog/setup-role.ts), read off the schema entries that carry it.
import { simpleVerbs } from "./effect-schema-verbs.ts";
import { setupRoleOf, type SetupRole } from "./setup-role.ts";

export function verbsWithRole(role: SetupRole): ReadonlySet<string> {
  return new Set(simpleVerbs.filter((schema) => setupRoleOf(schema) === role).map((schema) => schema.shape.verb.value));
}

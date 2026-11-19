// What a mechanic family adds to the effect vocabulary: its verbs, triggers and stat flags (docs/architecture.md, Mechanic families). Each
// src/catalog/families/<family>.ts exports one `manifest`; src/catalog/families/index.ts lists them in order.
import type { z } from "zod";

/** A verb's schema, as far as the lists need it: its name is `shape.verb.value`. */
export type VerbSchema = { readonly shape: { readonly verb: z.ZodLiteral<string> } };

export type CatalogFamily = {
  /** The file name, which is also the folder of the family's rules in src/rules/families. */
  readonly name: string;
  readonly verbs: readonly VerbSchema[];
  readonly triggers: readonly string[];
  readonly flags: readonly string[];
};

type Field = "verbs" | "triggers" | "flags";

/** The tuple of one field over a tuple of families, in list order, so the schemas the lists build keep their literal types. */
// Tail-recursive with an accumulator, so a long list of families does not reach the compiler's instantiation depth.
export type Collect<List extends readonly CatalogFamily[], Key extends Field, Acc extends readonly unknown[] = readonly []> = List extends readonly [infer Head extends CatalogFamily, ...infer Tail extends readonly CatalogFamily[]]
  ? Collect<Tail, Key, readonly [...Acc, ...Head[Key]]>
  : Acc;

export function collect<const List extends readonly CatalogFamily[], const Key extends Field>(families: List, key: Key): Collect<List, Key> {
  return families.flatMap((family): readonly unknown[] => family[key]) as unknown as Collect<List, Key>;
}

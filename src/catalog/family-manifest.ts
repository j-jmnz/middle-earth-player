// What a mechanic family adds to the effect vocabulary: its verbs, triggers and stat flags (docs/architecture.md, Mechanic families). Each
// src/catalog/families/<family>.ts exports one `manifest`; src/catalog/families/index.ts lists them in order.
import type { z } from "zod";

/** A verb's schema, as far as the lists need it: its name is `shape.verb.value`. */
export type VerbSchema = { readonly shape: { readonly verb: z.ZodLiteral<string> } };

/**
 * A verb of the family that leaves cards set aside which the players must not see (rr.in-play-and-out-of-play: set aside is out of play; the Setup or the card says "facedown" or
 * picks at random). The table's Set aside list counts such a card and never names it (src/play/store/set-aside.ts, docs/design-system-table.md, Reading panels). The declaration holds
 * no card code: it says where the verb's instruction names the cards, so a later scenario's record of the same verb is covered when it is written.
 *   - `codes`: the instruction's fields that list card codes. A set-aside card with one of them is facedown.
 *   - `names`: its fields that hold a card title, for a random pick among set-aside cards. The cards with the title are facedown when different cards of the game bear it
 *     (the four Send for Help); a pick among copies of one card hides nothing, and those stay named (Gondorian Warship).
 *   - `deck`: the verb sets a facedown deck aside, or reveals facedown cards from there one by one. Every set-aside encounter card of the game is then facedown, objectives too,
 *     but the cards of an encounter set that `openSets` names: a verb and its field, read from the same record as the declared verb. That set waits set aside, named by the Setup, and
 *     the deck counts as set aside once a card of the set has left the set-aside zone; with no `openSets` the rule holds for the whole game (src/play/store/set-aside.ts says why).
 * A declaration holds for a game while a card with one of its records is in that game.
 */
export type AsideSecret = {
  readonly verb: string;
  readonly codes?: readonly string[];
  readonly names?: readonly string[];
  readonly deck?: true;
  readonly openSets?: { readonly verb: string; readonly field: string };
};

/**
 * A verb of the family that parks cards in the set-aside zone which are no part of the game: the instruction's `sets` fields name the encounter sets it chooses among, and a set none of
 * whose cards has left the set-aside zone was not chosen. Its cards are left out of the Set aside list, neither named nor counted (the Quick-build's sets). A card of a chosen set that
 * lies set aside is not left out.
 */
export type AsideUnused = { readonly verb: string; readonly sets: readonly string[] };

export type CatalogFamily = {
  /** The file name, which is also the folder of the family's rules in src/rules/families. */
  readonly name: string;
  readonly verbs: readonly VerbSchema[];
  readonly triggers: readonly string[];
  readonly flags: readonly string[];
  /** The verbs that hide a set-aside card, if the family has one (scripts/checks/set-aside-sites.test.ts holds every engine site to a group). */
  readonly asideSecrets?: readonly AsideSecret[];
  /** The verbs that park cards the game does not use in the set-aside zone. */
  readonly asideUnused?: readonly AsideUnused[];
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

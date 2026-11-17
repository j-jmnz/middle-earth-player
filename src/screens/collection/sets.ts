// The Collection screen's switches, from data/collection.json (src/catalog/collection.ts): parsed on the first call, then kept.
import collectionJson from "../../../data/collection.json";
import { claimedPacks, collectionSchema, type CollectionSet } from "../../catalog/collection";

let sets: readonly CollectionSet[] | null = null;
let claimed: ReadonlySet<string> | null = null;

/** Every switch, in the file's order: each heading's sets together. */
export function collectionSets(): readonly CollectionSet[] {
  sets ??= collectionSchema.parse(collectionJson);
  return sets;
}

/** The packs some switch holds. */
export function collectionPacks(): ReadonlySet<string> {
  claimed ??= claimedPacks(collectionSets());
  return claimed;
}

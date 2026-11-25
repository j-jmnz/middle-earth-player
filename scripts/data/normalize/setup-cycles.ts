import { readAgainstTheShadow } from "./setup-against-the-shadow.ts";
import { readDwarrowdelf } from "./setup-dwarrowdelf.ts";
import { readHobbit } from "./setup-hobbit.ts";
import { readShadowsOfMirkwood } from "./setup-shadows-of-mirkwood.ts";
import { readHaradrim } from "./setup-haradrim.ts";
import { readTheRingMaker } from "./setup-the-ring-maker.ts";
import { readStandaloneScenarios } from "./setup-standalone-scenarios.ts";
import type { NameIndex, SetupClause } from "./setup-text.ts";

// The Setup sentences of the cycles' stage 1A cards (scripts/data/campaign-defs.ts, `kind: "cycle"`): each cycle has a reader of its own, and a sentence none of them reads
// returns null for the other patterns. A cycle's reader is added here, and nowhere else in the Setup normaliser.
export function readCycles(sentence: string, names: NameIndex, before: readonly SetupClause[]): SetupClause[] | null {
  return readShadowsOfMirkwood(sentence, names) ?? readDwarrowdelf(sentence, names) ?? readHobbit(sentence, names) ?? readAgainstTheShadow(sentence, names, before) ?? readTheRingMaker(sentence, names) ?? readHaradrim(sentence, names) ?? readStandaloneScenarios(sentence, names);
}

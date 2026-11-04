// The scenarios the words test (src/play/words/scenario-words.test.ts) reads: the playable ones and every scaffolded one (a golden.test.ts exists).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import { ROOT } from "../../scripts/data/paths.ts";

const SCENARIOS_DIR = path.join(ROOT, "src/campaign/scenarios");

export const WORDS_SCENARIOS: readonly string[] = [
  ...new Set([...PLAYABLE_SCENARIOS, ...readdirSync(SCENARIOS_DIR).filter((id) => existsSync(path.join(SCENARIOS_DIR, id, "golden.test.ts")))]),
].sort();

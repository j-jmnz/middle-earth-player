import path from "node:path";

import { BaseSequencer, type TestSpecification } from "vitest/node";

// The order and the shards of a Vitest run (vitest.config.mts, sequence.sequencer). Whole games are what the suite spends its time on
// (.claude/rules/code-standards.md, Test cost), and the files that play them are short: Vitest's own fallback, without timings from
// an earlier run, runs larger files first, so a fresh clone or a CI runner started the card smoke shards and the goldens last and
// waited on them. The heavy files are the slow list and every scenario's golden test.
// - Order: with an earlier run's timings for every file, Vitest's (failed first, then longest first). Otherwise the heavy files
//   first, each kind in Vitest's order, so the cores share the long games and the short files fill in behind them.
// - Shards (`--shard=<i>/<n>`): the heavy files dealt in turn to each shard and the rest dealt the same way, so each shard gets a share
//   of the long games. Every file is in exactly one shard.

export const GOLDEN_FILES = "src/campaign/scenarios/*/golden.test.ts";

export function heavyIn(root: string, slow: readonly string[]): (spec: TestSpecification) => boolean {
  const globs = [...slow, GOLDEN_FILES];
  return (spec) => {
    const file = path.relative(root, spec.moduleId).split(path.sep).join("/");
    return globs.some((glob) => path.matchesGlob(file, glob));
  };
}

/** A sequencer class for vitest.config.mts that runs and shards the `slow` files (globs from the root) and the goldens first. */
export function heavyFirst(slow: readonly string[]): typeof BaseSequencer {
  return class HeavyFirstSequencer extends BaseSequencer {
    override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
      const sorted = await super.sort(files);
      const timed = files.every((spec) => this.ctx.cache.getTestSpecificationResult(spec) !== undefined);
      if (timed) return sorted;
      const heavy = heavyIn(this.ctx.config.root, slow);
      return [...sorted.filter(heavy), ...sorted.filter((spec) => !heavy(spec))];
    }

    override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
      const { root, shard } = this.ctx.config;
      if (!shard) return files;
      const heavy = heavyIn(root, slow);
      const byPath = [...files].sort((a, b) => (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0));
      const dealt = byPath.filter(heavy).filter((_, at) => at % shard.count === shard.index - 1);
      const rest = byPath.filter((spec) => !heavy(spec));
      return [...dealt, ...rest.filter((_, at) => at % shard.count === shard.index - 1)];
    }
  };
}

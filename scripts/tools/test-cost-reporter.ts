import { writeFileSync } from "node:fs";
import path from "node:path";

// A Vitest reporter for `pnpm test:scenario`: it writes each test file's time (collect, hooks and tests, as Vitest's diagnostic counts it)
// to the JSON file TEST_COST_OUT names, so the run can hold the scenario's tests to their budget (scripts/tools/test-scenario.ts,
// Test budget). It prints nothing; the default reporter runs beside it.

type Diagnostic = { collectDuration: number; duration: number };
type TestModule = { moduleId: string; diagnostic(): Diagnostic };

export default class TestCostReporter {
  private readonly times: Record<string, number> = {};

  onTestModuleEnd(module: TestModule): void {
    const diagnostic = module.diagnostic();
    this.times[path.relative(process.cwd(), module.moduleId)] = diagnostic.collectDuration + diagnostic.duration;
  }

  onTestRunEnd(): void {
    const out = process.env.TEST_COST_OUT;
    if (out) writeFileSync(out, JSON.stringify(this.times));
  }
}

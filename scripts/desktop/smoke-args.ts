// The flags of `pnpm desktop smoke` (scripts/checks/desktop-smoke.ts), parsed apart from the run so a test can read them.
import path from "node:path";

export type SmokeArgs = {
  /** The packed app's executable (`--app`), or null to launch the checkout's shell on the seeded export. */
  packed: string | null;
  skipBuild: boolean;
  /** `--require-bundle`: the picture and the booklet checks run and fail when the bundle lacks them, instead of being skipped when this checkout packed no scans or booklets (the release job). */
  requireBundle: boolean;
  /** `--expect-version <x.y.z>`: the app must report this version, which the release's tag stamped. */
  expectVersion: string | null;
};

function valueOf(args: readonly string[], name: string): string | null {
  const at = args.indexOf(name);
  if (at < 0) return null;
  const value = args[at + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

export function parseSmokeArgs(args: readonly string[]): SmokeArgs {
  const app = valueOf(args, "--app");
  const requireBundle = args.includes("--require-bundle");
  if (requireBundle && app === null) throw new Error("--require-bundle checks a packed app: pass --app <path> too");
  return { packed: app === null ? null : path.resolve(app), skipBuild: args.includes("--skip-build"), requireBundle, expectVersion: valueOf(args, "--expect-version") };
}

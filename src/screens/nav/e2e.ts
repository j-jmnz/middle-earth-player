// A build made with EXPO_PUBLIC_E2E_SEED=1 (the README showcase build) sets it; Expo inlines EXPO_PUBLIC_ variables at build time. With it, a deal
// uses that fixed seed so a scripted run deals the same game every run, and the fixture route writes fixture saves. Every
// build ships the fixture route; without the variable it is inert and writes nothing.
function e2eSeed(): number | null {
  const fixed = Number(process.env.EXPO_PUBLIC_E2E_SEED);
  return Number.isInteger(fixed) && fixed > 0 ? fixed : null;
}

/** The seed of a deal: the e2e seed in the e2e-test build, otherwise a random one. */
export function dealSeed(random: () => number = Math.random): number {
  return e2eSeed() ?? 1 + Math.floor(random() * 0x7fffffff);
}

/** True in the e2e-test build only. The fixture route ships in every build and writes a save only when this holds. */
export function e2eBuild(): boolean {
  return e2eSeed() != null;
}

/** The `at` of an e2e fixture link (`/e2e/duo?at=5`): how many of the fixture's intents to keep, or undefined for all of them. */
export function e2eAt(value: string | readonly string[] | undefined): number | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" && /^\d+$/.test(text) ? Number(text) : undefined;
}

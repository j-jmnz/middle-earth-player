// The seed of a deal. A production build deals a random one. The e2e-test build (eas.json) sets EXPO_PUBLIC_E2E_SEED, so a
// Maestro flow deals the same game every run. Expo inlines EXPO_PUBLIC_ variables at build time; a build without the
// variable ignores this.
export function dealSeed(random: () => number = Math.random): number {
  const fixed = Number(process.env.EXPO_PUBLIC_E2E_SEED);
  if (Number.isInteger(fixed) && fixed > 0) return fixed;
  return 1 + Math.floor(random() * 0x7fffffff);
}

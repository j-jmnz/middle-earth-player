// How expo-image may cache a picture. On Android it loads a bundled file (a number from require) as
// android.resource://<package>/<resource id> and keys its disk cache by that URI, but a build numbers its drawables
// alphabetically, so a file added to the bundle moves the id of every file after it and the cache kept from the last install
// answers with another card's picture (the 13 side B pictures moved Frodo Baggins onto the old Dagger of Westernesse). A bundled
// file is on the phone already: it is cached in memory only. A downloaded file keeps the policy asked for.
export type CachePolicy = "memory-disk" | "disk" | "memory" | "none";

export function cachePolicyFor(source: unknown, wanted: CachePolicy = "disk"): CachePolicy {
  if (typeof source !== "number") return wanted;
  return wanted === "none" ? "none" : "memory";
}

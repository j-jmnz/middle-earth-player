import { z } from "zod";

// Where a card or a scenario comes from (docs/brief.md, Data sources, Fan-made content). The field is absent on official content, so
// no official data file carries it; a fan-made card or scenario names its publisher and, for a card, the version of the set.
export const originSchema = z.strictObject({ publisher: z.string().min(1), version: z.string().min(1).optional() });

export type Origin = { kind: "official" } | { kind: "fan-made"; publisher: string; version?: string };

/** The origin of a card or a scenario's facts: what a screen reads to say a scenario is fan-made. */
export function originOf(facts: { origin?: z.infer<typeof originSchema> | undefined }): Origin {
  const origin = facts.origin;
  if (origin === undefined) return { kind: "official" };
  return origin.version === undefined ? { kind: "fan-made", publisher: origin.publisher } : { kind: "fan-made", publisher: origin.publisher, version: origin.version };
}

export const isFanMade = (facts: { origin?: z.infer<typeof originSchema> | undefined }): boolean => originOf(facts).kind === "fan-made";

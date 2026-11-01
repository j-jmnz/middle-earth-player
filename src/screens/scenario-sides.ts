// The sides of a scenario's quest cards as the briefing's preview shows them (scenario-cards.tsx). Pure, so a test reads it.

/** The quest cards in stage order, each on side A then side B, labelled "Stage 1A", "Stage 1B". */
export function questSides(stages: readonly string[]): { code: string; side: "A" | "B"; label: string }[] {
  return stages.flatMap((code, at) => [
    { code, side: "A" as const, label: `Stage ${at + 1}A` },
    { code, side: "B" as const, label: `Stage ${at + 1}B` },
  ]);
}

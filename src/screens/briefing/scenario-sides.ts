// The sides of a scenario's quest cards as the briefing's preview shows them (scenario-cards.tsx). Pure, so a test reads it.

/** The quest cards in stage order, each on side A then side B, labelled "Stage 1A", "Stage 1B". */
export function questSides(stages: readonly string[]): { code: string; side: "A" | "B"; label: string }[] {
  return stages.flatMap((code, at) => [
    { code, side: "A" as const, label: `Stage ${at + 1}A` },
    { code, side: "B" as const, label: `Stage ${at + 1}B` },
  ]);
}

/** A campaign card of the setup screen: its code and the name of the scenario it belongs to. */
export type CampaignCardEntry = { code: string; scenario: string };

/** The campaign cards in book order, each on side A (Setup) then side B (Resolution), labelled with their scenario ("The Hunt for Gollum · Setup"). */
export function campaignSides(entries: readonly CampaignCardEntry[]): { code: string; side: "A" | "B"; label: string }[] {
  return entries.flatMap((entry) => [
    { code: entry.code, side: "A" as const, label: `${entry.scenario} · Setup` },
    { code: entry.code, side: "B" as const, label: `${entry.scenario} · Resolution` },
  ]);
}

/** The campaign's cards in book order: each scenario's card, a scenario with none left out. */
export function campaignCardEntries(scenarios: readonly { id: string; name: string }[], campaignCards: Readonly<Record<string, string>>): CampaignCardEntry[] {
  return scenarios.flatMap((scenario) => {
    const code = campaignCards[scenario.id];
    return code ? [{ code, scenario: scenario.name }] : [];
  });
}

// Rules: rr.victory (data/rules/entries.json); ledger lines 12195:B:1, 11215:B:4.
// The words of a campaign won: the Resolution line the last campaign card prints ("The players win the campaign!", read from the printed-text ledger) and where the campaign stands. The Resolution screen shows them under the title when the win completes the campaign, the path under its road.
import { sideText } from "../../play/cards/ledger";

export type CampaignEnd = {
  /** "Ered Mithrin won. The players win the campaign!" (the printed line is left out when the campaign card prints none). */
  won: string;
  /** The campaign card's printed line, without its "Resolution:" label; null when it prints none. */
  line: string | null;
  /** "Ered Mithrin is complete: 9 of 9 scenarios won." */
  summary: string;
};

// The line of the campaign card's back that says the players win the campaign, without the "Resolution:" label.
function winLine(campaignCard: string | null): string | null {
  const lines = campaignCard ? (sideText(campaignCard, "B")?.split("\n") ?? []) : [];
  const found = lines.find((line) => /win the campaign/i.test(line));
  return found ? found.replace(/^Resolution:\s*/, "") : null;
}

/** The words of the campaign's end: its name and the number of its scenarios, and the campaign card (of its last scenario) whose printed line says the players win. */
export function campaignEnd(campaign: { name: string; scenarios: readonly string[] }, campaignCard: string | null): CampaignEnd {
  const line = winLine(campaignCard);
  return { won: line ? `${campaign.name} won. ${line}` : `${campaign.name} won.`, line, summary: `${campaign.name} is complete: ${campaign.scenarios.length} of ${campaign.scenarios.length} scenarios won.` };
}

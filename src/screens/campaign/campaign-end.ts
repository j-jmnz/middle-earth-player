// Rules: rr.victory (data/rules/entries.json); ledger lines 12195:B:1, 11215:B:4, 146079:B:1.
// The words of a campaign's end: the Resolution line the last campaign card prints ("The players win the campaign!", read from the printed-text ledger) and where the campaign stands, or, for a campaign whose last Resolution chose how it ends (The
// Return of the King's Mount Doom), what the log records. The Resolution screen shows them under the title when the win completes the campaign, the path under its road.
import { sideText } from "../../play/cards/ledger";
import type { CampaignEnd as Ended } from "../../catalog/campaign-record";
import { campaignEndLine } from "../../campaign/return-of-the-king-words";

export type CampaignEnd = {
  /** "Ered Mithrin won. The players win the campaign!" (the printed line is left out when the campaign card prints none). A campaign the players lost: "The Return of the King lost. The One Ring is kept. The players lose the campaign." */
  won: string;
  /** The campaign card's printed line, without its "Resolution:" label; null when it prints none. The line the players lost the campaign by, when they did. */
  line: string | null;
  /** "Ered Mithrin is complete: 9 of 9 scenarios won."; null when the players lost the campaign. */
  summary: string | null;
  /** "danger" when the players lost the campaign. */
  tone: "default" | "danger";
};

// The line of the campaign card's back that says the players win the campaign, without the "Resolution:" label.
function winLine(campaignCard: string | null): string | null {
  const lines = campaignCard ? (sideText(campaignCard, "B")?.split("\n") ?? []) : [];
  const found = lines.find((line) => /win the campaign/i.test(line));
  return found ? found.replace(/^Resolution:\s*/, "") : null;
}

/**
 * The words of the campaign's end: its name and the number of its scenarios, and the campaign card (of its last scenario) whose printed line says the players win. `ended` is what the log recorded when the last
 * Resolution decided how the campaign ends (a card whose back offers the choice prints one line for each option, so no printed line stands for it); it words the end instead of the card.
 */
export function campaignEnd(campaign: { name: string; scenarios: readonly string[] }, campaignCard: string | null, ended: Ended | null = null): CampaignEnd {
  if (ended === "lost") return { won: `${campaign.name} lost. ${campaignEndLine("lost")}`, line: campaignEndLine("lost"), summary: null, tone: "danger" };
  const line = ended === "won" ? campaignEndLine("won") : winLine(campaignCard);
  return { won: line ? `${campaign.name} won. ${line}` : `${campaign.name} won.`, line, summary: `${campaign.name} is complete: ${campaign.scenarios.length} of ${campaign.scenarios.length} scenarios won.`, tone: "default" };
}

// Rules: dcce.scalable-upgradable, dcce.campaign-mode (data/rules/entries.json). The printed value of a stat on the side a card shows.
import type { ModifierStat } from "../catalog/boundary.ts";

import { LOST_ISLAND_THREAT } from "./families/uncharted-pick.ts";
import type { PrintedCard } from "./printed.ts";
import type { CardInstance } from "./state.ts";

type CardStat = "willpower" | "attack" | "defense" | "threat" | "questPoints" | "engagementCost";

// The printed value of a stat, on the side the card shows: a card dealt on its Upgraded side, or turned to its Campaign Mode only side, prints that side's stats (dcce.scalable-upgradable).
export function printedStat(printed: PrintedCard, stat: ModifierStat, face?: CardInstance["face"]): number {
  // The Lost Island side of a double-sided location prints a Threat and no quest points (dcce.uncharted); the Temple of the Deceived side of a map location prints its own Threat (4).
  if (face === "B" && printed.keywords.uncharted && (stat === "threat" || stat === "questPoints")) return stat === "threat" ? (printed.upgraded?.threat ?? LOST_ISLAND_THREAT) : 0;
  const upgraded = face === "B" ? printed.upgraded : null;
  if (upgraded) {
    switch (stat) {
      case "willpower":
        if (upgraded.willpower != null) return upgraded.willpower;
        break;
      case "attack":
      case "defense":
        return upgraded[stat];
      case "hitPoints":
        return upgraded.health;
      // The Threat and engagement cost the other side prints when they differ from the front's (the Thing in the Depths' Campaign Mode only side, Sea Serpent's Enraged side).
      case "threat":
      case "engagementCost":
        if (upgraded[stat] != null) return upgraded[stat];
        break;
      default:
        break;
    }
  }
  switch (stat) {
    case "willpower":
    case "attack":
    case "defense":
    case "threat":
    case "questPoints":
    case "engagementCost":
      return printed[stat satisfies CardStat] ?? 0;
    case "hitPoints":
      return printed.health ?? 0;
    default:
      return 0;
  }
}

/** The Victory the card scores on the side it shows: the Campaign Mode only side of The Thing in the Depths and the Enraged side of Sea Serpent print their own (dcce.campaign-mode). */
export function victoryOf(instance: Pick<CardInstance, "face">, printed: PrintedCard): number | null {
  return (instance.face === "B" ? printed.upgraded?.victory : undefined) ?? printed.victory;
}

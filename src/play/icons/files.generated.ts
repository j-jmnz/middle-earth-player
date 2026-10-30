// Written by pnpm data:build (scripts/data/icons.ts). Do not edit.
// The asset of each icon, for expo-image (SVG and PNG) and Skia images. Imported by components only: Node tests read
// ./generated.ts.
import type { CardBackName, IconName } from "./generated";

export const ICON_FILES: Record<IconName, number> = {
  "willpower": require("../../../assets/icons/willpower.svg") as number,
  "attack": require("../../../assets/icons/attack.svg") as number,
  "defense": require("../../../assets/icons/defense.svg") as number,
  "hitPoints": require("../../../assets/icons/hitPoints.svg") as number,
  "threat": require("../../../assets/icons/threat.svg") as number,
  "shadow": require("../../../assets/icons/shadow.svg") as number,
  "cost": require("../../../assets/icons/cost.svg") as number,
  "unique": require("../../../assets/icons/unique.svg") as number,
  "leadership": require("../../../assets/icons/leadership.svg") as number,
  "tactics": require("../../../assets/icons/tactics.svg") as number,
  "spirit": require("../../../assets/icons/spirit.svg") as number,
  "lore": require("../../../assets/icons/lore.svg") as number,
  "fellowship": require("../../../assets/icons/fellowship.svg") as number,
  "baggins": require("../../../assets/icons/baggins.svg") as number,
  "neutral": require("../../../assets/icons/neutral.svg") as number,
  "hero": require("../../../assets/icons/hero.svg") as number,
  "ally": require("../../../assets/icons/ally.svg") as number,
  "attachment": require("../../../assets/icons/attachment.svg") as number,
  "event": require("../../../assets/icons/event.svg") as number,
  "treasure": require("../../../assets/icons/treasure.svg") as number,
  "playerSideQuest": require("../../../assets/icons/playerSideQuest.svg") as number,
  "contract": require("../../../assets/icons/contract.svg") as number,
  "oneRing": require("../../../assets/icons/oneRing.svg") as number,
  "nightmare": require("../../../assets/icons/nightmare.svg") as number,
  "questPoints": require("../../../assets/icons/questPoints.png") as number,
  "engagementCost": require("../../../assets/icons/engagementCost.png") as number,
  "resource": require("../../../assets/icons/resource.png") as number,
  "damage": require("../../../assets/icons/damage.png") as number,
  "progress": require("../../../assets/icons/progress.png") as number,
};

export const CARD_BACK_FILES: Record<CardBackName, number> = {
  "player": require("../../../assets/icons/playerBack.jpg") as number,
  "encounter": require("../../../assets/icons/encounterBack.jpg") as number,
};

const PLAYER_TYPE_CODES = new Set([
  "hero",
  "ally",
  "attachment",
  "event",
  "contract",
  "player-side-quest",
]);

const NON_PLAYER_TYPE_CODES = new Set([
  "campaign",
  "encounter",
  "quest",
  "nightmare",
  "enemy",
  "location",
  "treachery",
  "objective",
  "encounter-side-quest",
  "ship-enemy",
  "ship-objective",
]);

// `campaignKind` is the card's campaign kind where the caller knows it (Card.campaignKind): a campaign treasure is told from the plain "treasure"
// rows by it, since Ered Mithrin's treasures print the type name Treasure, not Campaign.
export function deckLegal(typeCode: string, typeName: string, campaignKind?: string | null): boolean {
  if (typeName === "Campaign") return false;
  // An Ered Mithrin treasure (emce.treasure) is never deck-legal: a discovered one is admitted by the campaign log, outside the 50 card minimum.
  if (campaignKind === "treasure") return false;

  // 2026-10-23: every live treasure row has type_name Campaign, so the check above
  // already rejects them. A treasure is deck-legal only when type_name is not
  // Campaign. Do not mark every treasure legal.
  if (typeCode === "treasure") return true;

  if (PLAYER_TYPE_CODES.has(typeCode)) return true;
  if (NON_PLAYER_TYPE_CODES.has(typeCode)) return false;

  throw new Error(`Unknown type code "${typeCode}" (${typeName})`);
}

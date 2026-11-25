// The keyword and stat readers and the damage, destroy and threat writers of the core, split by job; this file keeps the path every caller imports.
// A new keyword or flag reader goes in keyword-flags.ts, a stat rule in modified-stat.ts, a damage guard in damage.ts, a rule about a card leaving play in destroy.ts.
export { addModifier, defenseAsDefender, modifiedStat, printedStat, versusDefender, versusHighEngagement } from "./modified-stat.ts";
export { hasKeyword, indestructible, isEncounterCardEffect, isPlayerCardEffect, placedAmount, playerCardEffectCanChoose, printedKeywordsBlank, sourcePrinted, toughnessOf, uniqueBlocked } from "./keyword-flags.ts";
export { damageHeld, placeDamage, type DamageSource } from "./damage.ts";
export { defeatedDestination, destroyAndAnnounce, destroyCard, destroyOverwhelmed, releaseAttachments } from "./destroy.ts";
export { lowerThreat, raiseThreat } from "./threat-dial.ts";

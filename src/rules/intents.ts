export type EngineStep =
  | { kind: "push"; frame: string; cardId: string | null; peril: boolean }
  | { kind: "pop"; frame: string; cardId: string | null; peril: boolean }
  | { kind: "draw"; seat: number; cardId: string }
  | { kind: "gainResource"; seat: number; heroId: string }
  | { kind: "damage"; targetId: string; amount: number }
  | { kind: "threat"; seat: number; amount: number }
  | { kind: "progress"; targetId: string; amount: number }
  | { kind: "destroy"; targetId: string }
  | { kind: "eliminate"; seat: number }
  | { kind: "reveal"; seat: number; cardId: string }
  | { kind: "engage"; seat: number; enemyId: string }
  | { kind: "commit"; cardId: string }
  | { kind: "hideCommit"; cardId: string }
  | { kind: "hideTest"; cardId: string; discardedIds: readonly string[]; willpower: number; threat: number; success: boolean }
  | { kind: "advance"; cardId: string }
  | { kind: "attack"; side: "enemy" | "player"; seat: number; enemyId: string };

export type Payment = { heroId: string; amount: number };

export type PlayerIntent =
  | { type: "Keep" }
  | { type: "Mulligan" }
  | { type: "Pass" }
  | { type: "PlayCard"; cardId: string; payments: readonly Payment[]; hostId?: string }
  | { type: "Commit"; cardIds: readonly string[] }
  | { type: "CommitHide"; cardIds: readonly string[] }
  | { type: "Travel"; locationId: string }
  | { type: "DeclineTravel" }
  | { type: "Engage"; enemyId: string }
  | { type: "DeclineEngage" }
  | { type: "ChooseEnemy"; enemyId: string }
  | { type: "DeclareDefender"; defenderId: string }
  | { type: "Undefended"; heroId?: string }
  | { type: "DeclareAttackers"; enemyId: string; attackerIds: readonly string[] }
  | { type: "DeclineAttack" }
  | { type: "Distribute"; assignments: readonly { cardId: string; amount: number }[] }
  | { type: "Trigger"; cardId: string; effectId: string }
  | { type: "ChooseResolution"; optionId: string }
  | { type: "Draw"; amount?: number }
  | { type: "GainResources"; amount?: number }
  | { type: "PayCost"; amount?: number }
  | { type: "DealDamage"; amount?: number }
  | { type: "PlaceProgress"; amount?: number }
  | { type: "RaiseThreat"; amount?: number };

export type LegalIntent =
  | { type: "Keep" }
  | { type: "Mulligan" }
  | { type: "Pass" }
  | { type: "PlayCard"; cardId: string }
  | { type: "Commit" }
  | { type: "CommitHide" }
  | { type: "Travel" }
  | { type: "DeclineTravel" }
  | { type: "Engage" }
  | { type: "DeclineEngage" }
  | { type: "ChooseEnemy" }
  | { type: "DeclareDefender" }
  | { type: "Undefended" }
  | { type: "DeclareAttackers" }
  | { type: "DeclineAttack" }
  | { type: "Distribute"; total: number }
  | { type: "Trigger"; cardId: string; effectId: string };

export type Selection =
  | { type: "PlayCard"; cardId: string }
  | { type: "Commit" }
  | { type: "CommitHide" }
  | { type: "Travel" }
  | { type: "Engage" }
  | { type: "ChooseEnemy" }
  | { type: "DeclareDefender" }
  | { type: "Undefended" }
  | { type: "DeclareAttackers"; cardId: string }
  | { type: "Distribute" };

export const ENGINE_NUMBER_INTENTS = new Set<PlayerIntent["type"]>([
  "Draw",
  "GainResources",
  "PayCost",
  "DealDamage",
  "PlaceProgress",
  "RaiseThreat",
]);

export function suppliesNumber(intent: PlayerIntent): boolean {
  if (ENGINE_NUMBER_INTENTS.has(intent.type)) return true;
  const record = intent as { amount?: unknown; damage?: unknown; threat?: unknown; progress?: unknown };
  return record.amount != null || record.damage != null || record.threat != null || record.progress != null;
}

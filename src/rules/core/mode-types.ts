// The phases of a round and the modes the state machine parks in (engine/machine.ts). phaseOf in state.ts maps a mode to its phase.

export type Phase =
  | "Setup"
  | "Mulligan"
  | "Beginning of round"
  | "Resource"
  | "Planning"
  | "Quest"
  | "Travel"
  | "Encounter"
  | "Combat"
  | "Refresh"
  | "End of round";

export type ModeName =
  | "mulligan"
  | "openingHands"
  | "afterOpening"
  | "beginRound"
  | "resourceGrant"
  | "resourceActions"
  | "planning"
  | "questCommit"
  | "staging"
  | "resolution"
  | "travel"
  | "optionalEngage"
  | "engagement"
  | "combatStart"
  | "combatShadows"
  | "combatActions"
  | "enemyAttacks"
  | "playerAttacks"
  | "refresh"
  | "endRound"
  | "stopped";

// Rules: rm.scour, rm.the-orcs-search, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 08122:B:3, 08122:B:4, 08123:B:3, 08123:B:4, 08124:A:1, 08125:A:1, 08125:A:2, 08126:A:1, 08126:A:3, 08127:A:1, 08127:A:2.
// What the table says of Celebrimbor's Secret's pieces (src/play/readouts/ring-maker/celebrimbor.ts, src/play/cards/ring-maker/celebrimbor-preview.ts): the cards underneath The Orcs' Search as a count, the locations near going under it,
// Celebrimbor's Mould wherever it lies, the stage gate and Bellach's immunity. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import { plural } from "../../list.ts";

/** The cards facedown under The Orcs' Search: what they cost each player at the end of the refresh phase and that Bellach's Threat is the same number (08125:A:2, 08124:A:1). */
export const searchNote = (cards: number): string =>
  cards === 0
    ? "No cards lie underneath The Orcs' Search. A location whose damage reaches its quest points goes there, facedown."
    : `${plural(cards, "card")} lie facedown underneath The Orcs' Search. At the end of the refresh phase each player raises their threat by ${cards}. Bellach's Threat is ${cards}.`;

/** A damaged location in play near its printed quest points: at the quest points it goes underneath The Orcs' Search (08125:A:1); The Secret Chamber there loses the game (08126:A:3). */
export const nearBuriedWords = (name: string, damage: number, points: number, loses: boolean): string =>
  `${name} has ${damage} of ${points} damage. At ${points} it goes underneath The Orcs' Search${loses ? ", and the players lose the game" : ""}.`;

/** The name of the Mould's host in a line. */
const heldBy = (host: string): string => `Celebrimbor's Mould is held by ${host}.`;

/** The Mould's line in the preview, by what holds it (08127:A:1, A:2). */
export function mouldWords(where: "hero" | "location" | "bellach" | "free", host: string): string {
  if (where === "hero") return `${heldBy(host)} If ${host} leaves play, the players lose the game.`;
  if (where === "location") return `${heldBy(host)} It is not free of encounters while ${host} is in play. When ${host} leaves play, the Mould returns to the staging area, and the first player claims it once it is free.`;
  if (where === "bellach") return `${heldBy(host)} No hero holds it, so the stage cannot advance. If ${host} leaves play, the Mould returns to the staging area, and the first player claims it once it is free.`;
  return "Celebrimbor's Mould is in the staging area. Once it is free of encounters, the first player claims it and attaches it to a hero they control. If that hero leaves play, the players lose the game.";
}

/** The line on the host: a hero that holds the Mould, or the card that keeps it from the players. */
export const mouldHostWords = (where: "hero" | "location" | "bellach", host: string): string =>
  where === "hero" ? `${host} holds Celebrimbor's Mould. If it leaves play, the players lose the game.` : where === "bellach" ? `${host} holds Celebrimbor's Mould. No hero holds it, so the stage cannot advance.` : `${host} holds Celebrimbor's Mould. The Mould is not free of encounters while ${host} is in play.`;

/** The pill of a card that holds the Mould. */
export const MOULD_MARK = { text: "held", loses: false, speech: "Celebrimbor's Mould held" } as const;

/** The dial's line for the gate of both stages (08122:B:4, 08123:B:4): progress stays on the stage until a hero holds the Mould. */
export const mouldGateWords = (stage: 1 | 2, onHero: boolean): string =>
  onHero ? "A hero holds the Mould, so the stage advances as it fills." : `No hero holds the Mould, so the stage cannot ${stage === 1 ? "advance" : "be defeated"}. It keeps its progress and ${stage === 1 ? "advances" : "is defeated"} the moment a hero holds it.`;

/** Bellach in the preview (08122:B:3, 08123:B:3, 08124:A:1): Threat from the cards underneath The Orcs' Search, and whether he is immune and cannot be engaged. */
export function bellachWords(cards: number, shielded: boolean, stage: 1 | 2 | null, progress: number): string {
  const threat = `Bellach's Threat is ${cards}, one for each card underneath The Orcs' Search.`;
  if (!shielded) return `${threat} The stage holds 12 progress, so players can engage Bellach and choose him with player card effects.`;
  const until = stage === 2 ? ` until stage 2 has 12 progress (${progress} now)` : "";
  return `${threat} He is immune to player card effects and cannot be engaged${until}.`;
}

/** The Secret Chamber in the preview (08126:A:1 to A:3): Threat from the players, immune, the travel cost and the loss when it goes underneath The Orcs' Search. */
export const chamberWords = (players: number, damage: number, points: number): string =>
  `Threat ${players}, one for each player. Immune to player card effects. To travel here, remove 3 progress from the current quest. ${damage} of ${points} damage: at ${points} it goes underneath The Orcs' Search, and the players lose the game.`;

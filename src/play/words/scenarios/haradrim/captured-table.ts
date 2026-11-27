// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.blank (data/rules/entries.json); ledger lines 17119:A:1, 17119:A:3, 17120:A:1, 17120:A:3, 17131:A:1, 17132:A:1 (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Table).
// What the table says of the characters an encounter card holds in The Dungeons of Cirith Gurat (src/play/readouts/haradrim/captured.ts). The engine decided each fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

const capital = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/** Who gains Abaan when his holder leaves play: "The first player (Player 1) gains" two-handed, "You gain" alone; `seat` is the first player. */
const gains = (seat: number, seats: number): string => (seats > 1 ? `The first player (Player ${seat + 1}) gains` : "You gain");

/** The preview of a captured ally: whose it is, who holds it and when it comes back. `owner` is "Player 2's" or "your" (said with a capital when it starts the sentence); `host` the card that holds it. */
export const capturedAllyWords = (owner: string, host: string): string =>
  `${capital(owner)} ally, held by ${host}. No player controls it, its text box is blank and it is a guarded objective. It returns to its owner, exhausted, when ${host} leaves play.`;

/** The preview of Abaan while a card holds him: no owner, the loss and who gains him (`seat` the first player). */
export const capturedAbaanWords = (host: string, seat: number, seats: number): string =>
  `Held by ${host}, a guarded objective with a blank text box. ${gains(seat, seats)} control of him when ${host} leaves play. If he leaves play, the players lose the game.`;

/** The preview of a card that holds characters: each named with its owner ("Quickbeam (Player 1's ally)"; `owner` is null for one with no owner, Abaan), and what frees them. */
export const holdsCapturedWords = (held: readonly { name: string; owner: string | null }[], host: string, seat: number, seats: number): string => {
  const owned = held.filter((one) => one.owner != null);
  const free = held.filter((one) => one.owner == null).map((one) => one.name);
  const back = owned.length > 0 ? ` ${owned.map((one) => one.name).join(", ")} return${owned.length === 1 ? "s" : ""} to ${owned.length === 1 ? "its" : "their"} owner${owned.length === 1 ? "" : "s"}, exhausted, when ${host} leaves play.` : "";
  const gained = free.length > 0 ? ` ${gains(seat, seats)} control of ${free.join(", ")} when ${host} leaves play.` : "";
  return `Holds ${held.map((one) => (one.owner != null ? `${one.name} (${one.owner} ally)` : one.name)).join(", ")}.${back}${gained}`;
};

/** The line a seat's dial says of one ally an encounter card holds. */
export const capturedDialWords = (ally: string, host: string): string => `${ally} is captured by ${host}`;

// Who takes control: a named player in a game of more than one, "you" alone. The log names a player as "Player N" in every game (`seats` 2).
const takes = (seat: number, seats: number, what: string): string => (seats > 1 ? `Player ${seat + 1} takes control of ${what}` : `You take control of ${what}`);

/** The banner and log line of a `captive` step: a character attached to an encounter card, a captive rescued to its owner (null: the owner left the game and it went to the discard pile), or Abaan freed to the first player. `seats` is 2 for the log. */
export function capturedStepWords(step: { event: "captured" | "rescued" | "free"; seat: number | null }, character: string, host: string, seats: number): string {
  if (step.event === "captured") return `${character} is captured by ${host}.`;
  if (step.event === "free") return `${character} is free: ${takes(step.seat ?? 0, seats, "him")}.`;
  return step.seat == null ? `${character} is rescued: its owner has left the game, so it goes to the discard pile.` : `${character} is rescued: ${takes(step.seat, seats, "it")}, exhausted.`;
}

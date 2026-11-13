// Rules: mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.create-staging-area, mec108.joining-another-player, mec108.time-x, mec108.side-quests-in-play, mec108.setup-escape-from-mount-gram (data/rules/entries.json); ledger lines 10038:A:1, 10038:B:1, 10039:A:1, 10039:B:2, 10053:A:3, 10174:A:2, 10175:A:1.
// What the table says of Escape from Mount Gram's pieces (src/play/readouts/gram.ts, src/play/cards/gram-preview.ts): each seat's captured deck, the cards captured under a card, a seat joined to another player's area, the starting threat the quest card sets, Loot the Dungeons in every area and
// Stop the Executioners' time. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
const sentence = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/** The seat mark: "P1 · Captured 12" (the count is the captured deck, which a screen reader hears), "Captured 12 · joined P2" for a seat that joined another player's area. */
export const capturedLabel = (seat: number | null, count: number, joined: number | null): string => `${seat == null ? "" : `P${seat + 1} · `}Captured ${count}${joined == null ? "" : ` · joined P${joined + 1}`}`;

/** The note spoken after the dial: whose captured deck it is and what the cards in it are for. */
export const capturedDeckWords = (owner: string, count: number): string =>
  count === 0 ? `${sentence(owner)} captured deck is empty. Capture takes nothing from it.` : `${sentence(owner)} captured deck holds ${plural(count, "card", "cards")}, out of play. Capture takes cards from its top, and they come back when what holds them leaves play.`;

/** The seat that joined another player's area: it shares that area's staging cards and stage (mec108.joining-another-player). */
export const joinedWords = (owner: string, other: string): string => `${sentence(owner)} stage 2B was emptied, so ${other} area is shared: its staging cards, its stage and its progress.`;

/** The threat the quest card set at the start: the cost of the starting hero (10038:A:1), said in round 1. */
export const startThreatWords = (threat: number, hero: string | null): string => `Starting threat is ${threat}${hero ? `, the threat cost of ${hero}` : ""}. It is not raised again when other heroes are rescued.`;

/** The line under a card that holds captured cards, in its preview: how many, whose, and when they come back. `owners` is a list of seats' owner words with counts. */
export const heldCapturedWords = (owners: readonly { owner: string; count: number }[]): string => {
  const total = owners.reduce((sum, one) => sum + one.count, 0);
  const whose = owners.map((one) => `${one.count} of ${one.owner}`).join(", ");
  return `${plural(total, "card", "cards")} captured underneath, out of play and facedown (${whose}). They are rescued to their owners when this leaves play.`;
};

/** The pill on a card that holds captured cards: "3 captured", spoken with the owners. */
export const capturedPill = (owners: readonly { owner: string; count: number }[]): { text: string; loses: boolean; speech: string } => {
  const total = owners.reduce((sum, one) => sum + one.count, 0);
  return { text: `${total} captured`, loses: false, speech: `${plural(total, "card", "cards")} captured underneath: ${owners.map((one) => `${one.count} of ${one.owner}`).join(", ")}` };
};

/** The line under a captured card itself. */
export const capturedCardWords = (host: string, owner: string | null): string => `Captured, facedown under ${host}, out of play${owner ? `, ${owner}` : ""}. It is rescued when ${host} leaves play.`;

/** Loot the Dungeons: one card in every area at once (10175:A:1), its quest points and what lies under it. */
export const lootWords = (points: number, players: number): string => `In every player's staging area at once: one card, one set of progress. It has ${points} quest points, 4 and 4 more for each of the ${plural(players, "player", "players")}.`;

/** The dial of Stop the Executioners' time counters, and what the last one does (10053:A:3). */
export const executionersTimeWords = (left: number): string =>
  `${plural(left, "time counter", "time counters")} left. One comes off at the end of each refresh phase. With the last gone, every card captured under it is discarded and each player raises threat by 3 for each of their characters discarded that way.`;
export const executionersNearWords = (left: number): string => (left <= 1 ? "The next refresh phase takes the last time counter: the cards under it are discarded." : `${left} time counters are left.`);
export const executionersPreviewWords = (left: number): string => `${plural(left, "time counter", "time counters")} on it. With the last gone, the cards captured under it are discarded, heroes among them die, and the quest leaves the game.`;

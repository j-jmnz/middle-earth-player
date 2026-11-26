// Rules: rm.attacks-against-nalir, rr.first-player, rr.ownership-and-control (data/rules/entries.json); ledger lines 08068:A:1, 08068:A:3, 08071:A:2, 08102:A:1, 08102:A:2, 08102:A:3, 08103:A:2, 08103:A:3.
// What the table says of Nalir in Trouble in Tharbad (src/play/cards/ring-maker/preview.ts): who controls him, that control follows the first player token, and that his leaving play loses the game. The engine decided each; these only say it.

/** Nalir's line in the preview: the player who controls him (named in a game of several, else "You"). */
export const nalirControlledWords = (owner: string | null): string => `${owner ? `${owner} controls` : "You control"} Nalir. He passes to the first player each round, and if he leaves play the players lose. An attack against Nalir sends undefended damage to him.`;

/** The Crossing at Tharbad's quest points in the preview, the total the engine reads and how it is made up: "12 quest points (10, +2 for each player)". `each` is what each player adds. */
export const crossingPointsWords = (total: number, printed: number, each: number): string => `${total} quest points (${printed}, ${each >= 0 ? "+" : ""}${each} for each player)`;

/** Nalir in The Nîn-in-Eilph: the first player controls him from the Setup, and each refresh phase costs that player threat for each player (08102:A:1, A:2, A:3). */
export const ninNalirWords = (owner: string | null, players: number): string => `${owner ? `${owner} controls` : "You control"} Nalir. He passes to the first player each round, and if he leaves play the players lose. At the start of each refresh phase the first player raises their threat by ${players}.`;

/** The Ancient Marsh-dweller's resource tokens (08103:A:2, A:3): each is +1 Threat and +1 Attack, and one is added each time time counters come off the current quest. */
export const marshDwellerWords = (tokens: number): string => `Ancient Marsh-dweller has ${tokens === 1 ? "1 resource token" : `${tokens} resource tokens`}: +${tokens} Threat and +${tokens} Attack. It gets one more each time time counters come off the current quest.`;

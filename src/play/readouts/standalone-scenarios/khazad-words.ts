// Rules: rr.damage, rr.guarded, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51301:B:1, 51307:B:2, 51307:B:3, 51351:A:1 (docs/brief.md, Escape from Khazad-dûm, The table). The words of the pieces Escape from Khazad-dûm's cards hold on the table (khazad.ts beside it):
// the damage on The Bridge of Khazad-dûm against the number that loses the game, and Durin's Bane while Dark Pit's flip holds it out of play. Each sentence stays at about 25 words. Pure.

/** The damage on the stage 3B that loses the game, the way the dial's note says it. */
export const stageDamageWords = (stage: string, damage: number, limit: number): string =>
  `${stage} holds ${damage} of ${limit} damage. At the beginning of each quest phase Durin's Bane attacks: undefended damage, and damage past a defender, goes on this stage. At ${limit} the players lose.`;

/** The warning of the dial when one more attack of Durin's Bane could lose the game (`attack` is its Attack) or the next damage does. */
export const stageDamageNearWords = (damage: number, limit: number, attack: number): string =>
  damage + 1 >= limit ? "One more damage on the stage loses the game." : `Durin's Bane attacks with ${attack}: an undefended attack at ${damage} damage on the stage loses the game.`;

export const stageDamageLimitWords = (limit: number): string => `${limit} damage on the stage loses the game`;

/** The dial that says Durin's Bane lies set aside, out of play, until a stage 3 card adds it to the staging area. */
export const baneAsideWords = (): string => "Durin's Bane lies set aside, out of play: Dark Pit flipped when it was explored. The stage 3 card the first player chose adds it to the staging area.";

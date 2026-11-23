// Rules: docs/scenarios/standalone-scenarios/the-siege-of-annuminas.md (The Siege of Annúminas, The table), rr.forced (data/rules/entries.json); ledger lines 50801:B:2, 50812:A:1, 50812:A:2, 50814:A:2, 50820:A:2. The words of the city strength dial (annuminas.ts beside it). Pure.

/** What the end of the round deals to Annúminas, the way the dial's note says it: 1 damage for each enemy in play, Battering Ram's X and City Wall's 4 when it is discarded. */
export const incomingWords = (enemies: number, ram: number, wall: number): string => {
  const parts = [`${enemies} for the enemies in play`, ...(ram > 0 ? [`${ram} from Battering Ram`] : []), ...(wall > 0 ? [`${wall} from City Wall`] : [])];
  return `At the end of the round Annúminas takes ${parts.join(", ")}.`;
};

/** The note of the dial: the strength, what the round takes, the loss at 0 and the cost of a player lost. */
export const cityWords = (strength: number, incoming: string): string => `Annúminas holds a city strength of ${strength}. ${incoming} At 0 the players lose the game. A player who is eliminated costs it 9.`;

export const cityNearWords = (strength: number): string => `Annúminas holds ${strength}. At 0 the players lose the game.`;

export const cityOverrunWords = (strength: number, incoming: number): string => `The end of the round deals ${incoming} damage to Annúminas, which holds ${strength}: the players lose the game.`;

// Rules: mec112.wizardry, rr.player-elimination, rr.resources (data/rules/entries.json); ledger lines 143078:B:2, 143079:B:2, 143046:A:1, 143048:A:2, 143080:B:3. The words of The Road to Isengard's table dials (src/play/readouts/isengard.ts).

/** What a screen reader hears after the damage on stage 2B: how many more advance the players, and to where. */
export const damageLimitWords = (value: number, limit: number, next: string): string => `${Math.max(0, limit - value)} more and the players advance to ${next}`;

/** What Rouse the Ents' resource tokens are: the encounter cards revealed on advancing (143078:B:2), shown beside the number. */
export const REVEALS_WORDS = "encounter cards revealed on advancing to stage 2A";

/** What an Ent of Fangorn's resources count toward (143046:A:1): the player who puts the last one on takes control of it. */
export const entLimitWords = (value: number, limit: number): string => `${Math.max(0, limit - value)} more and the player who adds it takes control of the Ent`;

/** What Saruman's hit points left are (143048:A:2): the win gate. */
export const gateWords = (left: number): string => (left > 0 ? `${left} hit points left, so the players cannot win` : "none left, so defeating the stage wins");

/** A hand dial's warning on The Voice of Saruman (143080:B:3): the player with no cards is eliminated, so 1 card is one play from it. */
export const handWarning = (count: number): { level: "near" | "critical"; words: string } | undefined =>
  count === 0 ? { level: "critical", words: "no cards in hand, eliminated" } : count === 1 ? { level: "near", words: "1 card in hand: playing or discarding it eliminates the player" } : undefined;

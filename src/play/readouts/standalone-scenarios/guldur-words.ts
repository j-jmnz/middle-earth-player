// Rules: docs/scenarios/standalone-scenarios.md (Attack on Dol Guldur, The table), rr.forced, rr.victory (data/rules/entries.json); ledger lines 50907:A:1, 50931:A:1, 50931:B:1, 50931:B:3. The words of the city strength dial (guldur.ts beside it). Pure.

/** What the end of a stage 3 round takes off the city strength: the Siege value of the enemies destroyed and the locations explored this round. */
export const tallyWords = (tally: number, atStage3: boolean): string =>
  atStage3 ? `At the end of the round the ${tally} Siege value of the enemies destroyed and the locations explored this round comes off it.` : "Until stage 3 nothing comes off it.";

/** The note of the dial: the strength, what the round takes, and what 0 does. */
export const guldurCityWords = (strength: number, tally: string): string =>
  `Dol Guldur holds a city strength of ${strength}. ${tally} At 0 the Lieutenants lose Indestructible, and with none in play at the end of a round the players win.`;

export const guldurNearWords = (strength: number): string => `Dol Guldur holds ${strength}. At 0 the Lieutenants lose Indestructible.`;

export const guldurZeroWords = (tally: number): string => `The end of the round takes ${tally} off Dol Guldur's city strength: it falls to 0.`;

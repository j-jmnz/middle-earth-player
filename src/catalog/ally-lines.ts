// The Ered Mithrin Campaign Log's "Unique Allies Protecting Wilderland" lines (emce.boon-allies, MEC115 p.27): the four boon allies, each of
// whom either joins the Campaign Pool or is traded for a line the log records. A later campaign card reads the line ("If \"Turayn has taken
// an oath of vigilance,\" search the encounter deck for 3 treacheries and remove them from the game"). Plain data, shared by the effect
// schema (conditions and verbs), the Resolution and the screens.
export const ALLY_LINES = ["turayn", "melanwar", "isolde", "beldis"] as const;
export type AllyLine = (typeof ALLY_LINES)[number];

/** The ally each line stands for (the boon ally's code) and the line as the Campaign Log prints it. */
export const ALLY_LINE_FACTS: Readonly<Record<AllyLine, { ally: string; words: string }>> = {
  turayn: { ally: "12166", words: "Turayn has taken an oath of vigilance" },
  melanwar: { ally: "12169", words: "Melanwar has given you guidance on traversing Wilderland" },
  isolde: { ally: "12171", words: "Isolde is on the hunt" },
  beldis: { ally: "12188", words: "Beldis’s care has bolstered the heroes’ spirits" },
};

/** The most uses of Beldis a player has, the four boxes beside her on the Campaign Log (emce.campaign-log). */
export const BELDIS_BOXES = 4;

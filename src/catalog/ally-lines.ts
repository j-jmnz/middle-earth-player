// The Ered Mithrin Campaign Log's "Unique Allies Protecting Wilderland" lines (emce.boon-allies, MEC115 p.27): the four boon allies, each of
// whom either joins the Campaign Pool or is traded for a line the log records. A later campaign card reads the line ("If \"Turayn has taken
// an oath of vigilance,\" search the encounter deck for 3 treacheries and remove them from the game"). Plain data, shared by the effect
// schema (conditions and verbs), the Resolution and the screens.
export const ALLY_LINES = ["turayn", "melanwar", "isolde", "beldis"] as const;
export type AllyLine = (typeof ALLY_LINES)[number];

/**
 * The ally each line stands for (the boon ally's code), the line as the Campaign Log prints it, and what a later campaign card does when the line is recorded (`later`: the cards it removes from
 * the encounter deck at Setup, read from the printed text of those campaign cards).
 */
export const ALLY_LINE_FACTS: Readonly<Record<AllyLine, { ally: string; words: string; later: string }>> = {
  turayn: { ally: "12166", words: "Turayn has taken an oath of vigilance", later: "3 treacheries in The King's Quest, 3 non-unique locations in Fire in the Night and 3 non-unique enemies in The Fate of Wilderland" },
  melanwar: { ally: "12169", words: "Melanwar has given you guidance on traversing Wilderland", later: "2 non-unique locations and 1 Caves location in The Withered Heath and in Mount Gundabad, and 3 non-unique enemies in Roam Across Rhovanion" },
  isolde: { ally: "12171", words: "Isolde is on the hunt", later: "3 non-unique enemies in The Withered Heath and in Fire in the Night, and 3 treacheries in The Ghost of Framsburg" },
  beldis: { ally: "12188", words: "Beldis’s care has bolstered the heroes’ spirits", later: "3 non-unique locations in The Ghost of Framsburg, and 3 treacheries in Mount Gundabad and in The Fate of Wilderland" },
};

/** The most uses of Beldis a player has, the four boxes beside her on the Campaign Log (emce.campaign-log). */
export const BELDIS_BOXES = 4;

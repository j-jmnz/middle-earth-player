// Rules: dcce.heading, dcce.sailing-tests, dcce.corsair-deck, dcce.stormcaller-elite, dcce.stormcallers-area (data/rules/entries.json). The sea family's state, types only;
// state.ts holds it as `sea`, and the family's modules read and write it.

// The Heading card's four settings, from the best (the only one that is on-course) to the worst (dcce.heading): Sun, Cloud, Rain, Storm. A
// shift off-course moves one step toward Storm, a shift on-course one step toward Sun.
export const HEADINGS = ["Sun", "Cloud", "Rain", "Storm"] as const;
export type Heading = (typeof HEADINGS)[number];

// Where a card goes in place of a discard pile that is not its own: a non-ship enemy to the Corsair discard pile (dcce.corsair-deck), and a
// Stormcaller Elite card, which has no encounter card back and so never enters the encounter deck or its discard pile, to the victory display
// as an enemy and out of the game as an objective ally (dcce.stormcaller-elite).
export type SeaRoute = "corsair" | "victory" | "removed";

// A Sailing test the first player is performing (dcce.sailing-tests). "ask": the heading has shifted off-course and the first player chooses the
// characters to commit (a Commit intent, or a Pass for none, which looks at nothing); the cards are looked at at once, and when they show Sailing
// success symbols and the heading can still shift on-course the test waits at "shift": `looked` are the cards looked at (still on top of the
// encounter deck, for the table to show), `left` the symbols not yet answered, each answered by choosing "shift" or "keep". With no symbol to
// answer, or once the heading is back on Sun, it waits at "look": the same cards, one answer ("done") before they are discarded.
export type SailingTest = { step: "ask" } | { step: "shift"; looked: readonly string[]; left: number } | { step: "look"; looked: readonly string[] };

// Where an enemy stood before a location held it out of play: the staging area, or engaged with this seat.
export type HeldEnemy = { zone: "staging" | "engaged"; seat: number | null };

export type SeaState = {
  // The Heading card's setting, or null before the fleet is prepared (no Heading card yet).
  heading: Heading | null;
  // The Heading card attached to the Dream-chaser, once it is.
  headingCard: string | null;
  // The route of each card code that has one, set when the game is dealt (families/sea/routes.ts).
  routes: Readonly<Record<string, SeaRoute>>;
  // The first player is choosing what to commit to this round's Sailing test.
  sailing?: SailingTest;
  // Enemies a location holds out of play, facedown under it, while it is the active location (families/sea/islet.ts): where each stood, to put it back.
  held?: Readonly<Record<string, HeldEnemy>>;
  // The Ship objectives that were exhausted when the settle sweep last looked, kept only in a game whose cards hear `shipExhausted` (families/sea/water.ts).
  exhausted?: readonly string[];
  // The Stormcaller's area, once a Setup has prepared it (families/stormcaller/area.ts).
  stormcaller?: StormcallerArea;
};

// The Stormcaller's area (dcce.stormcallers-area): the Stormcaller enemy card, its current quest stage (2C to 4C, a card of the area zone) and the stages still to come (set aside, out of play, in
// order), the number of the current stage (2 to 4), and the cards that belong to the area. A member stands in the `stormcallerArea` zone while the players are at another stage and in the staging
// area while they are at the same stage (dcce.stormcallers-area-stages); a member that leaves both (engaged, explored, discarded) stops being one.
export type StormcallerArea = {
  card: string;
  stage: string;
  number: number;
  deck: readonly string[];
  members: readonly string[];
};

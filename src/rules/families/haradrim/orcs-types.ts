// Rules: hrd.orcs-area, hrd.prepare-the-orcs-area (data/rules/entries.json); ledger line 17047:A:1.
// The state of the Orcs' area of Race Across Harad (`ScenarioState.orcs`): the Orcs' current quest stage, its number, the stages still in the Orcs' quest deck and the cards of the area. The cards stand in the `orcsArea` zone
// while the players are at another stage and in the staging area at the same stage (orcs-area.ts). Unlike the Stormcaller's area it has no card of its own and no ship behaviour: it never sets `state.sea`.
export type OrcsArea = {
  /** The card id of the Orcs' current quest stage (its D side up). */
  readonly stage: string;
  /** The stage number of that stage (1 to 4). */
  readonly number: number;
  /** The card ids of the stages still in the Orcs' quest deck, top first. */
  readonly deck: readonly string[];
  /** The enemies and locations of the area, in the order they joined, wherever they stand now (the area zone or the staging area). */
  readonly members: readonly string[];
};

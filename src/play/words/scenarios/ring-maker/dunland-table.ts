// Rules: rr.cannot, rr.engaged, rr.first-player, rm.does-not-stack, rr.refresh-phase, rr.active-location (data/rules/entries.json); ledger lines 08014:A:1, 08014:A:2, 08014:A:3, 08015:A:1, 08016:A:1, 08020:A:1.
// What the table says of The Dunland Trap's pieces (src/play/cards/ring-maker/preview.ts): Chief Turch, Hills of Dunland's draw effect, Munuv Dûv Ravine's bonus on Dunland enemies and Old South Road.
// The engine decided every fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** Chief Turch in the preview: what he cannot do, who he follows and what each engagement costs the players. */
export const turchWords = (): string => "Chief Turch cannot leave play or be destroyed. He engages the first player and follows the first player token. Each time an enemy engages a player, 1 time counter comes off the current quest.";

/** Hills of Dunland by where it lies: in the staging area it hunts on every draw, once for all copies; elsewhere it does nothing on a draw. */
export const hillsWords = (staged: boolean): string =>
  staged
    ? "In the staging area: after a player draws cards, the top card of the encounter deck is discarded. A Dunland enemy there enters play engaged with that player. Copies do not stack: only one acts."
    : "The draw effect of Hills of Dunland works only in the staging area. Travel: each player draws a card to travel here.";

/** Munuv Dûv Ravine in the preview: the bonuses its record gives (`+1 Attack`, `+1 Defense`) to the enemies with a trait, in the staging area and engaged or only engaged. */
export const ravineWords = (trait: string, staged: boolean, bonuses: readonly string[]): string => `${trait} enemies in play${staged ? ", staged or engaged," : ""} get ${bonuses.join(" and ")}.`;

/** Old South Road in the preview: the extra counter at the end of each refresh phase, besides the stage's own when the current stage prints Time X, and none to take from a stage that prints none (stage 2). */
export const oldSouthRoadWords = (stageHasTime: boolean): string => `At the end of each refresh phase, 1 time counter comes off the current quest${stageHasTime ? ", besides the one the stage takes." : ". The current stage has none."}`;

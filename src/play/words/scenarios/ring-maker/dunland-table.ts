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

/** Munuv Dûv Ravine in the preview: the bonus it gives to every Dunland enemy in play. */
export const ravineWords = (): string => "Dunland enemies in play, staged or engaged, get +1 Attack and +1 Defense.";

/** A Dunland enemy while Munuv Dûv Ravine is in play. */
export const ravineOnEnemyWords = (): string => "Munuv Dûv Ravine gives this Dunland enemy +1 Attack and +1 Defense while it is in play.";

/** Old South Road in the preview: the extra counter at the end of each refresh phase. */
export const oldSouthRoadWords = (): string => "At the end of each refresh phase, 1 time counter comes off the current quest, besides the one the stage takes.";

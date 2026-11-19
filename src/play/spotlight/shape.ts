// The combat spotlight's shapes (docs/design-system-table.md, Spotlight): distances in points, scales, shares and counts.
// Not durations (those are `MOTION` in src/ui/motion-tokens.ts), so the motion scale leaves them alone. Pure numbers, like `SHAPE`.
export const SPOT = {
  // The stage (spotlight/stage.ts): the cards stand at this share of the screen's height, at most this tall (pt), centered at this
  // share of it; the gap between the fan and the target is at least `gapMin` pt and `gapShare` of a card's width; at most `fan`
  // attackers stand as a fan, each `fanStep` of a card's width after the one before it and `fanTurn` degrees from it.
  height: 0.6,
  maxHeight: 340,
  centerY: 0.47,
  gapMin: 28,
  gapShare: 0.22,
  fan: 3,
  fanStep: 0.32,
  fanTurn: 6,
  // The turned shadow card: this share of a card, bottom-aligned, this far (pt) left of the fan.
  shadow: 0.72,
  shadowGap: 20,
  // The group keeps this much (pt) beyond the safe insets in all: 32 across the width, not at each side.
  margin: 32,
  // The attack value under the attackers: its number and its icon (pt).
  attackSize: 30,
  attackIcon: 22,
  // The gauge (spotlight/gauge.ts): each glyph takes `gaugeStep` pt at most and is at most `gaugeGlyph` pt. Under `gaugeMinStep` the hearts, then the shields, become one glyph and a count,
  // which keeps `gaugeCount` pt for its words. The gap between the shields and the hearts, and the undefended mark's place, are shares
  // of a step. Past `gaugeShields` shields or `gaugeHearts` hearts the row is a count at once.
  gaugeStep: 30,
  gaugeGlyph: 24,
  gaugeMinStep: 14,
  gaugeCount: 60,
  gaugeSep: 0.7,
  gaugeMark: 1.2,
  gaugeShields: 6,
  gaugeHearts: 12,
  // The middle of the stage (spotlight/stage.ts, focus) is over the gap between the front attacker and the target; the gauge stands
  // this share of a card's height under it, and may take this many card widths. During the count it grows by `gaugeFocus` and the
  // cards dim under a night veil of `focusVeil`. At most `gaugeAbsorbed` marks say how much of the attack a card effect took away.
  gaugeDrop: 0.29,
  gaugeRoom: 1.6,
  gaugeFocus: 0.3,
  focusVeil: 0.45,
  gaugeAbsorbed: 4,
  // The sizes of the words (pt, Medium's): the matchup line's numbers and words, the result, and the note; the room kept under the
  // attack value at the cards' feet to the bottom safe inset.
  matchupSize: 30,
  matchupWord: 22,
  resultSize: 40,
  noteSize: 15,
  footRoom: 24,
  // The note at the top: its height, the room above it to the top safe inset, and the room kept between it and the cards (pt); and
  // the room kept between the caption and the bottom safe inset.
  noteHeight: 30,
  noteRoom: 8,
  noteClear: 8,
  // The sparks a lost heart gives off: at most `embers` in all, at most `emberPer` for each heart.
  embers: 9,
  emberPer: 3,
  // The damage token art is this share of a card's height; its place in the target's corner is this far (pt) from the edges.
  token: 0.17,
  tokenInset: 2,
  // As shares of a card's height: the attacker draws back this far, is knocked back this far when it is blocked, and the target is
  // knocked back this far when it is hit (a blocked defender 0.4 of that).
  drawBack: 0.09,
  recoil: 0.06,
  knock: 0.05,
  knockBlocked: 0.4,
  // The attacker tilts this many degrees away while it draws back.
  tilt: 5,
  // The shields that held bounce to this scale when the attack is blocked; the result pops to this.
  bounce: 1.25,
  resultPeak: 1.3,
} as const;

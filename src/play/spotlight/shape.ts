// The combat spotlight's shapes (docs/plans/done/combat-spotlight-redesign.md, §2 and §3): distances in points, scales, shares and counts.
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
  // The stat medallions' radius (pt), straddling each card's foot.
  medal: 26,
  // The sizes of the words (pt, Medium's): the damage number, the stamps, the note chip, and the stamps' turn in degrees.
  numberSize: 64,
  stampSize: 34,
  noteSize: 15,
  stampTurn: -8,
  // The note chip: its height, the room under it to the bottom safe inset, and the room kept between it and a medallion (pt).
  noteHeight: 30,
  noteRoom: 8,
  noteClear: 8,
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
  // The defense medallion bounces to this scale when the attack is blocked; the damage number pops to this.
  bounce: 1.25,
  numberPeak: 1.4,
  // The number floats up this share of a card's height while it shows.
  numberRise: 0.08,
} as const;

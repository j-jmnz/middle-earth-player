// The width of the table's command column (the dock, at the right of the canvas), pure so a test reads it. At Medium it is 30% of the
// screen between 210 and 280 pt; at another UI scale (docs/design-system.md, Settings) the share is worked out in logical
// points and drawn at `scale`, so a bigger scale gets a bigger column, which holds its larger words.

export function commandWidth(screenWidth: number, scale = 1): number {
  return Math.round(Math.min(280, Math.max(210, (screenWidth / scale) * 0.3)) * scale);
}

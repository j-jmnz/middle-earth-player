// What the reader table is given while a reading panel is open over it (reader-panel.ts, docs/design-system-table.md, Screen reader). Pure.

/** What the reader table is given for `importantForAccessibility`: hidden with its descendants on Android while a panel is open. */
export function tableVisibility(platform: string, open: boolean): "no-hide-descendants" | undefined {
  return platform === "android" && open ? "no-hide-descendants" : undefined;
}

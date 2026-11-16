// The page's own stylesheet on the web and the desktop (web build only, started by splash-glow.canvaskit.tsx): two rules the phone's controls get another way.
//   - The focus ring (docs/design-system-table.md, Screen reader) for every control that does not draw it itself. The phone's controls wear it through `useFocusRing`
//     (focus-ring.canvaskit.ts); a Pressable that does not (the rail's items, History, the table's phase rail, the booklet's page region) showed the browser's own 1 px
//     outline. The design ring is 2 pt wide, 2 pt off, in accentHigh, for a keyboard's focus only (`:focus-visible`). A control that wears the ring itself puts the
//     browser's outline out inline while it shows, which wins over this rule, so a focused control wears one ring.
//   - The dock's "i" (`dock-more`) hit area. The phone pads the 26 pt pill to a 44 pt target with `hitSlop`, which react-native-web ignores, so a pseudo-element reaches
//     the same slop (top and bottom to 44 pt, 6 pt left, 12 pt right: table-dock.tsx) without moving the pill or the line's words.
//   - The fold headers (`section-<id>`, kit/fold-section.tsx): their Pressable is a plain box around a rounded face, so the ring follows the face's 12 pt radius, and it
//     stands above the section's body, which would otherwise paint over the ring's lower edge.
//   - The booklet's Close button sits on the window's bottom edge (routes/booklet/[id].tsx, which has no web variant): its bar keeps the ring's room below it.
// One stylesheet, written once and rewritten when the UI scale changes.
import { RING_OFFSET, RING_WIDTH, ringRoom } from "../focus-ring-style.ts";
import { tableSettings, type UiScaleOption } from "../table-settings.ts";
import { touchSlop, uiFactor } from "../ui-scale.ts";

const STYLE_ID = "page-styles";

// What takes a keyboard's focus: a control, a link and anything with a tab stop (a scroller that holds the keys). The table's own root takes keys, not a ring.
const FOCUSED = ':is([role="button"], [role="tab"], [role="link"], a, button, [tabindex]:not([tabindex="-1"])):not([data-testid="table"]):focus-visible';

// The dock's "i" pill is 26 pt at Medium (table-dock.tsx, PILL).
const PILL = 26;

const px = (value: number): string => `${Math.round(value * 100) / 100}px`;

/** The stylesheet's text for a UI scale. */
export function pageCss(scale: number): string {
  const tall = px(touchSlop(scale, PILL * scale));
  return [
    `${FOCUSED} { outline: ${px(RING_WIDTH * scale)} solid rgb(var(--accentHigh)); outline-offset: ${px(RING_OFFSET * scale)}; }`,
    `[role="button"][data-testid^="section-"]:focus-visible { position: relative; z-index: 1; border-radius: ${px(12 * scale)}; }`,
    `:has(> [data-testid="booklet-close"]) { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + ${px(ringRoom(scale))}); }`,
    `[data-testid="dock-more"] { position: relative; }`,
    `[data-testid="dock-more"]::after { content: ""; position: absolute; top: -${tall}; bottom: -${tall}; left: -${px(6 * scale)}; right: -${px(12 * scale)}; }`,
  ].join("\n");
}

function writeStyle(css: string): void {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

let started = false;

/**
 * Starts the stylesheet: once for the life of the page, like CanvasKit's load. The ring's colour is the theme's own variable (`--accentHigh`, which the root layout sets for
 * the theme in force), so a theme change needs nothing; the sizes follow the UI scale setting, read from the settings store.
 */
export function startPageStyles(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const write = (option: UiScaleOption) => writeStyle(pageCss(uiFactor(option)));
  write(tableSettings.getState().settings.uiScale);
  tableSettings.subscribe((state, previous) => {
    if (state.settings.uiScale !== previous.settings.uiScale) write(state.settings.uiScale);
  });
}

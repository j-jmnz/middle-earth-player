import type { ScenarioState } from "../../rules/core/state.ts";
import type { BeatStore } from "../store/beat-store.ts";
import type { SlotNumbers } from "../cards/card-effects.ts";
import type { OptionMark } from "../choice/sheet-types.ts";
import type { LayoutOptions } from "../layout/layout.ts";
import type { Reach, RowFeet } from "../layout/column-reach.ts";
import type { SpotlightHandoff } from "../spotlight/handoff.ts";
import type { ZoneFacts } from "../store/selectors.ts";
import type { StageArea } from "../spotlight/stage.ts";
import type { TableStore } from "../store/store.ts";

export type PictureSource = { uri: string } | number;

// What the open moment marks on the table: the cards a tap does something with, the ones picked (with the share a payment
// or archery gives each), and what a share is (resources paid, or damage assigned).
export type TableHighlight = {
  tappable: ReadonlySet<string>;
  picked: ReadonlyMap<string, number>;
  share: "pay" | "damage" | null;
  // A pick is open (a defender, a location, a payment): the cards it does not ask about are dimmed.
  dimOthers: boolean;
  // A number the open pick draws on a card it asks about: the damage a defender would take, in danger when it destroys it.
  marks: ReadonlyMap<string, OptionMark>;
  // Hand cards that cannot be played in this planning window (why.ts says why on a tap): dimmed.
  muted: ReadonlySet<string>;
  // The cards the open moment asks about or has picked, whether or not they glow now (the tray is open, or the table peeks): a row's fold never takes one (row-fold.ts).
  keep: ReadonlySet<string>;
};

// The engine's numbers the canvas draws on a card (card-effects.ts, slotNumbers): the effects on it, its willpower while it
// is committed, the quest points of a location or a quest stage, an enemy's engagement cost in staging against the threat,
// and whether a delayed effect will act on it.
export type SlotInfo = SlotNumbers;

export type TableCanvasProps = {
  store: TableStore;
  width: number;
  height: number;
  // The command column lies over the canvas's right edge, `column` points past `width`: the canvas draws that far, and a crowded top row
  // the column's empty top covers (`reach` rows, column-reach.ts) runs on into it (row-reach.ts). The hand and the play area stay in `width`.
  column?: number;
  // null: the screen has not measured the column and its dock yet, so the canvas only reports the rows' feet and lays nothing out (table-canvas.native.tsx).
  reach?: Reach | null;
  // Told the feet of the staging and engagement rows each time they move, so the screen can count the reach.
  onRowFeet?: (feet: RowFeet) => void;
  // The cached file (or bundled scan) for a code, or null while it is not on the phone.
  picture: (code: string) => PictureSource | null;
  // Moves when the image cache gains a file, so a card drawn as its name is tried again.
  pictureRevision: number;
  nameOf: (key: string) => string;
  // The sphere a card prints, for the icon on a card drawn as its name while its file is missing.
  sphereOf: (code: string) => string | null;
  // True for a card with a printed line the app does not apply (src/catalog/active-text.ts): the canvas marks it.
  inactive: (key: string) => boolean;
  // What the zone selectors read of a card's printing: its type (the fold order of staging) and its place among the ships (a seat's ships stand first).
  facts: ZoneFacts;
  // The success symbols a card's ledger side prints, for the Sailing test's look (look-strip.ts); 0 for a card with none.
  success: (code: string) => number;
  // The engine's numbers on a card, read from the state the canvas is handed (so a render never reads the store) and the seat drawn.
  info: (game: ScenarioState, seat: number, cardId: string) => SlotInfo;
  highlight: TableHighlight;
  // The cards the banner's current line names (the shadow card, the card damaged), ringed while the banner is at that line. The canvas
  // reads them itself, so a beat draws it and not the screen above it (beat-store.ts).
  beats: BeatStore;
  // The hand card the player is playing: drawn whole above the bottom edge.
  raised: string | null;
  // A fight picked and not confirmed yet, drawn as if declared.
  fight: LayoutOptions["preview"];
  // The bottom safe-area inset the hand stays above.
  bottomInset: number;
  // The screen the combat spotlight fills (spotlight/stage.ts): its size, where this canvas's corner is on it and the safe insets.
  stageArea: StageArea;
  // Where the canvas publishes the spotlight's plan and clock for the full-screen layer (spotlight/handoff.ts); the screen creates it once.
  handoff: SpotlightHandoff;
  // Readability (table-settings.ts): larger cards, and effect marks and token counts with strong outlines.
  look?: { contrast: boolean };
  // A tap on a card, or on a pile ("pile:discard"). The screen decides what it does; a tap never sends an intent.
  onTap: (cardId: string) => void;
  // A tap that hits no card or pile: the screen folds an open tray for it, as for the top of the command column.
  onEmptyTap?: () => void;
  // A long press on a face-up card: the screen shows it large over the table.
  onPreview: (cardId: string) => void;
  // A drag ended on one of the selected card's drop targets (a key from targetKey). The screen picks; it does not send.
  onDrop: (cardId: string, target: string) => void;
};

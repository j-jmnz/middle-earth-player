import type { SlotNumbers } from "./card-effects.ts";
import type { OptionMark } from "./sheet-types.ts";
import type { LayoutOptions } from "./layout.ts";
import type { TableStore } from "./store.ts";

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
};

// The engine's numbers the canvas draws on a card (card-effects.ts, slotNumbers): the effects on it, its willpower while it
// is committed, the quest points of a location or a quest stage, an enemy's engagement cost in staging against the threat,
// and whether a delayed effect will act on it.
export type SlotInfo = SlotNumbers;

export type TableCanvasProps = {
  store: TableStore;
  width: number;
  height: number;
  // The cached file (or bundled scan) for a code, or null while it is not on the phone.
  picture: (code: string) => PictureSource | null;
  // Moves when the image cache gains a file, so a card drawn as its name is tried again.
  pictureRevision: number;
  nameOf: (code: string) => string;
  // The sphere a card prints, for the icon on a card drawn as its name while its file is missing.
  sphereOf: (code: string) => string | null;
  // True for a card whose unique text has no effect record: the canvas veils its text box.
  inactive: (code: string) => boolean;
  // The engine's numbers on a card, read from the latest state. The canvas draws again when the cards, the effects in play
  // or the attack in progress change.
  info: (cardId: string) => SlotInfo;
  highlight: TableHighlight;
  // The hand card the player is playing: drawn whole above the bottom edge.
  raised: string | null;
  // A fight picked and not confirmed yet, drawn as if declared.
  fight: LayoutOptions["preview"];
  // The bottom safe-area inset the hand stays above.
  bottomInset: number;
  // A tap on a card, or on a pile ("pile:discard"). The screen decides what it does; a tap never sends an intent.
  onTap: (cardId: string) => void;
  // A long press on a face-up card: the screen shows it large over the table.
  onPreview: (cardId: string) => void;
  // A drag ended on one of the selected card's drop targets (a key from targetKey). The screen picks; it does not send.
  onDrop: (cardId: string, target: string) => void;
};

import type { CardEffects } from "./card-effects.ts";
import type { TableStore } from "./store.ts";

export type PictureSource = { uri: string } | number;

// What the open moment marks on the table: the cards a tap does something with, the ones picked (with the share a payment
// or archery gives each), and what a share is (resources paid, or damage assigned).
export type TableHighlight = {
  tappable: ReadonlySet<string>;
  picked: ReadonlyMap<string, number>;
  share: "pay" | "damage" | null;
};

// The engine's numbers the canvas draws on a card: the effects on it, its willpower while it is committed to the quest, and
// the quest points of a location or a quest stage.
export type SlotInfo = { effects: CardEffects; willpower: number | null; questPoints: number | null };

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
  info: (cardId: string) => SlotInfo;
  highlight: TableHighlight;
  // The hand card the player is playing: drawn whole above the bottom edge.
  raised: string | null;
  // A tap on a card, or on a pile ("pile:discard"). The screen decides what it does; a tap never sends an intent.
  onTap: (cardId: string) => void;
  // A long press on a face-up card: the screen shows it large over the table.
  onPreview: (cardId: string) => void;
  // A drag ended on one of the selected card's drop targets (a key from targetKey). The screen picks; it does not send.
  onDrop: (cardId: string, target: string) => void;
};

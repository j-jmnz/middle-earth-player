import type { TableStore } from "./store.ts";

export type PictureSource = { uri: string } | number;

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
  // A tap on a card. The picture stays on the canvas; the screen opens the inspect route.
  onInspect: (cardId: string) => void;
  // A long press on a face-up card: the screen shows it large over the table.
  onPreview: (cardId: string) => void;
  // A drag ended on one of the selected card's drop targets (a key from targetKey). The screen asks the reducer.
  onDrop: (cardId: string, target: string) => void;
};

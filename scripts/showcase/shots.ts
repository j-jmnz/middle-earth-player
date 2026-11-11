// The README showcase's shots (docs/showcase.md, Shot list): one per flow in .maestro/showcase/, the devices it is taken on, and the
// caption and alt text the README gives it. The iPad takes every shot in landscape; the iPhone takes the table in landscape and the rest in
// portrait (user decision, 2026-11-11). capture.ts runs the flows, build.ts turns what they write into the images, and the README links them.

export type Device = "iphone" | "ipad";
export type Theme = "dark" | "light";

export type Shot = {
  /** The flow's name (.maestro/showcase/<id>.yaml), and the files' last part (<device>-<theme>-<id>). */
  id: string;
  /** A GIF from the flow's recording, or a still from its screenshot. */
  kind: "still" | "gif";
  devices: readonly Device[];
  caption: string;
  alt: string;
};

/** Ringwraiths is the Dark theme, Rivendell the Light (docs/design-system.md, Color). */
export const THEMES: Readonly<Record<Theme, string>> = { dark: "Ringwraiths", light: "Rivendell" };

const BOTH: readonly Device[] = ["iphone", "ipad"];
const TABLE = BOTH;

export const SHOTS: readonly Shot[] = [
  { id: "table-quest", kind: "gif", devices: TABLE, caption: "The quest phase", alt: "A Shadow of the Past, round 3: the players commit their characters and the encounter cards are revealed into the staging area." },
  { id: "table-combat", kind: "gif", devices: TABLE, caption: "Combat", alt: "A Shadow of the Past: an enemy attacks, a hero defends, and the attack plays out full screen." },
  { id: "table-board", kind: "still", devices: TABLE, caption: "A Shadow of the Past", alt: "The game table in A Shadow of the Past, round 3: two players' heroes and allies with their attachments, an enemy engaged, the active location and the staging area." },
  { id: "table-sea", kind: "still", devices: TABLE, caption: "Voyage Across Belegaer", alt: "The game table in Voyage Across Belegaer, round 3: the ships, the Heading dial and the sea's own piles." },
  { id: "table-deep", kind: "still", devices: TABLE, caption: "Helm's Deep", alt: "The game table in Helm's Deep, round 3: enemies engaged with both players and the staging area full." },
  { id: "campaigns", kind: "still", devices: BOTH, caption: "Campaigns", alt: "The Campaigns screen: each campaign with its art, The Fellowship of the Ring under way." },
  { id: "path", kind: "still", devices: BOTH, caption: "Campaign path", alt: "The Fellowship of the Ring's campaign path, A Shadow of the Past on the table." },
  { id: "scenarios", kind: "still", devices: BOTH, caption: "Scenarios", alt: "The Scenarios screen: each scenario with its scene, grouped by product." },
  { id: "deck", kind: "still", devices: BOTH, caption: "Deck builder", alt: "The deck builder on the Stealth and Steadfastness starter deck: its heroes, its cards and their pictures." },
  { id: "cards", kind: "still", devices: BOTH, caption: "Card pool", alt: "The Cards tab: the player card pool as a grid of card pictures." },
  { id: "card", kind: "still", devices: BOTH, caption: "Card", alt: "The card screen of Aragorn: the card's picture and its text." },
  { id: "rules", kind: "still", devices: BOTH, caption: "Rules", alt: "The rules reference, with the booklets and the glossary." },
  { id: "settings", kind: "still", devices: BOTH, caption: "Settings", alt: "Settings: the Theme, UI scale and table choices." },
];

/** How a shot stands on a device: the table always lies landscape, and the iPad lies landscape for every screen. */
export function orientationOf(shot: string, device: Device): "portrait" | "landscape" {
  return device === "ipad" || shot.startsWith("table-") ? "landscape" : "portrait";
}

/** A capture's file name, without its extension. */
export function captureName(device: Device, theme: Theme, shot: string): string {
  return `${device}-${theme}-${shot}`;
}

/** The quarter turn a capture needs to stand as its shot does on its device: none when it already does, else clockwise (or counter-clockwise). */
export function turnFor(shot: Shot, device: Device, width: number, height: number, counter: boolean): 0 | 90 | 270 {
  const landscape = orientationOf(shot.id, device) === "landscape";
  if (landscape === width >= height) return 0;
  return counter ? 270 : 90;
}

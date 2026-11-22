// The passage cut for each music loop (docs/design-system-table.md, Sound): a track of the film trilogy's score, by its file name
// without the extension as the player's download names it, and the loop's start and end in seconds, found on the beat by a seam
// search and chosen by ear (user choice, 2026-11-21).
import type { MusicLoop } from "../../src/ui/sound/music-map.ts";

export type MusicPick = { file: string; start: number; end: number };

export const MUSIC_PICKS: Record<MusicLoop, MusicPick> = {
  menu: { file: "01 - The Prophecy", start: 134.5, end: 231 },
  shire: { file: "02 The Shire", start: 1.5, end: 137.74 },
  bree: { file: "06 - At The Sign Of The Prancing Pony", start: 26, end: 143.8 },
  shadow: { file: "03 - The Shadow Of The Past", start: 1.5, end: 133 },
  rivendell: { file: "05 Rivendell", start: 1.5, end: 204.58 },
  moria: { file: "12 Moria", start: 5, end: 139.73 },
  river: { file: "15 - The Great River", start: 1.5, end: 159.6 },
  rohan: { file: "01 Edoras", start: 55, end: 195.69 },
  fangorn: { file: "10 - Treebeard", start: 1.5, end: 156.9 },
  marshes: { file: "11 The Dead Marshes", start: 49.6, end: 279.18 },
  crossroads: { file: "02 - The Taming of Smeagol", start: 1.5, end: 153.24 },
  greycompany: { file: "08 The Passing Of The Grey Company", start: 1.5, end: 244.21 },
  gondor: { file: "04 - The White Tree", start: 46, end: 184.5 },
  morgul: { file: "06 - Minas Morgul", start: 1.5, end: 112.56 },
  cirith: { file: "09 - Cirith Ungol", start: 1.5, end: 89.2 },
  doom: { file: "14 - Hope Fails", start: 1.5, end: 121.1 },
  havens: { file: "18 - The Grey Havens (feat. Sir James Galway)", start: 177.4, end: 328.1 },
  nazgul: { file: "05 - The Black Rider", start: 1.5, end: 155.5 },
  weathertop: { file: "01 Weathertop", start: 1.5, end: 124.1 },
  chase: { file: "08 - Flight To The Ford", start: 74.7, end: 208.9 },
  isengard: { file: "04 - The Treason Of Isengard", start: 21, end: 232.53 },
  khazad: { file: "14 Balin's Tomb", start: 174.5, end: 339.6 },
  amonhen: { file: "16 - Amon Hen", start: 1.5, end: 173.1 },
  uruk: { file: "05 - The Uruk-hai", start: 1.5, end: 151.87 },
  helmsdeep: { file: "12 - Helm's Deep", start: 30.1, end: 171.5 },
  ents: { file: "10 The Last March Of The Ents", start: 1.5, end: 117.64 },
  deadpaths: { file: "11 The Paths Of The Dead", start: 109.6, end: 278.13 },
  siege: { file: "12 The Siege Of Gondor", start: 213.6, end: 429.81 },
  pelennor: { file: "13 - The Fields of the Pelennor", start: 1.5, end: 200.3 },
  shelob: { file: "11 - Shelob's Lair", start: 112.4, end: 230.59 },
  blackgate: { file: "15 - The Black Gate Opens (feat. Sir James Galway)", start: 1.5, end: 139.08 },
  crackofdoom: { file: "02 The Crack Of Doom", start: 1.5, end: 206.05 },
};

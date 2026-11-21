// The passage cut for each music loop (docs/design-system-table.md, Sound): a track of the film trilogy's score, by its file name
// without the extension as the player's download names it, and the loop's start and end in seconds, found on the beat by a seam
// search and chosen by ear (user choice, 2026-11-21).
import type { MusicLoop } from "../../src/ui/sound/music-map.ts";

export type MusicPick = { file: string; start: number; end: number };

export const MUSIC_PICKS: Record<MusicLoop, MusicPick> = {
  menu: { file: "01 - The Prophecy", start: 137.46, end: 197.6 },
  shire: { file: "02 The Shire", start: 67.59, end: 135.44 },
  bree: { file: "06 - At The Sign Of The Prancing Pony", start: 27.54, end: 91.39 },
  shadow: { file: "03 - The Shadow Of The Past", start: 130.59, end: 194.54 },
  rivendell: { file: "05 Rivendell", start: 66.46, end: 185.85 },
  moria: { file: "12 Moria", start: 39.73, end: 110.97 },
  river: { file: "15 - The Great River", start: 61.11, end: 142.59 },
  rohan: { file: "01 Edoras", start: 124.85, end: 187.39 },
  fangorn: { file: "10 - Treebeard", start: 20.99, end: 111.94 },
  marshes: { file: "11 The Dead Marshes", start: 112.71, end: 221.36 },
  crossroads: { file: "02 - The Taming of Smeagol", start: 6.34, end: 93.62 },
  greycompany: { file: "08 The Passing Of The Grey Company", start: 86.24, end: 204.27 },
  gondor: { file: "04 - The White Tree", start: 93.2, end: 157.43 },
  morgul: { file: "06 - Minas Morgul", start: 3.81, end: 69.06 },
  cirith: { file: "09 - Cirith Ungol", start: 26.4, end: 87.07 },
  doom: { file: "14 - Hope Fails", start: 56.77, end: 117.96 },
  havens: { file: "18 - The Grey Havens (feat. Sir James Galway)", start: 200.32, end: 278.52 },
  nazgul: { file: "05 - The Black Rider", start: 43.49, end: 115.8 },
  weathertop: { file: "01 Weathertop", start: 21.06, end: 85.17 },
  chase: { file: "08 - Flight To The Ford", start: 136.56, end: 201.76 },
  isengard: { file: "04 - The Treason Of Isengard", start: 131.1, end: 228.76 },
  khazad: { file: "14 Balin's Tomb", start: 185.92, end: 269.65 },
  amonhen: { file: "16 - Amon Hen", start: 41.15, end: 123.67 },
  uruk: { file: "05 - The Uruk-hai", start: 89.56, end: 149.77 },
  helmsdeep: { file: "12 - Helm's Deep", start: 35.67, end: 99.64 },
  ents: { file: "10 The Last March Of The Ents", start: 8.82, end: 70.47 },
  deadpaths: { file: "11 The Paths Of The Dead", start: 196.16, end: 277.48 },
  siege: { file: "12 The Siege Of Gondor", start: 223.52, end: 338.04 },
  pelennor: { file: "13 - The Fields of the Pelennor", start: 95.32, end: 188.1 },
  shelob: { file: "11 - Shelob's Lair", start: 153.02, end: 217.25 },
  blackgate: { file: "15 - The Black Gate Opens (feat. Sir James Galway)", start: 2.18, end: 71.47 },
  crackofdoom: { file: "02 The Crack Of Doom", start: 50.94, end: 161.94 },
};

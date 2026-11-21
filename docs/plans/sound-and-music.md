# Plan: music, and the rest of the sound

The sound effects are built (`docs/design-system-table.md`, Sound): the slots in `src/ui/sound/slots.ts`, the Darkest Dungeon II event cut for each in `scripts/build/sound-picks.ts` (user decision, 2026-11-21), packed by `pnpm assets sounds` from the player's own game files and never committed. This plan holds what is still open.

## Decisions

- **Releases carry no audio** (user decision, 2026-11-21): the files stay out of git and out of every release; a development build packs them from `.cache/audio`. Music follows the same rule.
- **"VFX".** The first request named VFX, but its points were all audio. If visual effects are also meant (card glows, combat particles, phase transitions), they are a separate plan. Open, for the user.
- **Hobbit score.** The Hobbit films' score would fit Mirkwood, Ered Mithrin and the dragon scenarios, outside the stated trilogy. Open, for the user.

## Sound effects still open

- The web and the desktop play none: `playSound` returns there, and the copies in `scripts/checks/web-copies.test.ts` leave the sound lines out. A desktop branch adds the Sound effects row to `setting-rows.canvaskit.tsx`, the strikes to `use-spotlight.canvaskit.ts`, the tab sound to `tab-bar.canvaskit.tsx`, and lets `playSound` run on the web after the first gesture.
- Slots packed but not played: `combat.engage`, `combat.roar`, `combat.miss`, `card.shuffle`, `card.deal`, `dread.treachery`, `ui.notice`. Each needs a moment the screen shows once (an engage motion, a Nazgûl reveal, a shuffle step, the Setup deal, a treachery's reveal, a banner worth a sound).

## Music: the film trilogy (idea, user request, 2026-11-18)

- Source: Howard Shore's score, from the three original soundtrack albums or The Complete Recordings, not from a film's mixed audio track, which carries dialogue and effects. The user downloads the albums whole and keeps the track numbers in the file names.
- Each scenario gets a calm loop and a combat loop, cut from the cue that scores the same place in the film; the boxes with no film scene take a mood's pair. The track titles are the original soundtrack's, written from memory: check them against the album downloaded, and use the Complete Recordings cue of the same scene where it has one.

Each row is the calm loop, then the combat loop.

| Scenario | Calm | Combat |
| --- | --- | --- |
| Menus | The Prophecy | (none) |
| A Shadow of the Past | Concerning Hobbits | The Black Rider |
| A Knife in the Dark | At the Sign of the Prancing Pony | A Knife in the Dark |
| Flight to the Ford | The Shadow of the Past | Flight to the Ford |
| The Ring Goes South | The Ring Goes South | The Treason of Isengard |
| Journey in the Dark | A Journey in the Dark | The Bridge of Khazad Dûm |
| Breaking of the Fellowship | The Great River | Amon Hen |
| The Uruk-hai | The Three Hunters | The Uruk-hai |
| Helm's Deep | The Riders of Rohan | Helm's Deep |
| The Road to Isengard | Treebeard | Isengard Unleashed |
| The Passage of the Marshes | The Taming of Sméagol | The Black Gate Is Closed |
| Journey to the Cross-roads | Samwise the Brave | Minas Morgul |
| Shelob's Lair | Twilight and Shadow | Shelob's Lair |
| The Passing of the Grey Company | Hope and Memory | Andúril |
| The Siege of Gondor | The Steward of Gondor | The White Tree |
| The Battle of the Pelennor Fields | The Ride of the Rohirrim | The Fields of the Pelennor |
| The Tower of Cirith Ungol | Cirith Ungol | Ash and Smoke |
| The Black Gate Opens | A Storm Is Coming | The Black Gate Opens |
| Mount Doom | Hope Fails | The End of All Things |

The boxes with no film scene take a mood's pair:

| Mood | Calm | Combat | Scenarios |
| --- | --- | --- | --- |
| Forest | The Shadow of the Past | The Black Rider | Passage Through Mirkwood, Lost in Mirkwood, Return to Mirkwood, The Hunt for Gollum, A Journey to Rhosgobel, Intruders in Chetwood |
| River and wilds | The Great River | The Uruk-hai | Journey Along the Anduin, Journey up the Anduin, Roam Across Rhovanion, Conflict at the Carrock, The Hills of Emyn Muil, The Dead Marshes |
| Hills | The Three Hunters | Forth Eorlingas | The Weather Hills, The Wastes of Eriador, Across the Ettenmoors, The Oath |
| Dark fortress | Minas Morgul | The Treason of Isengard | Escape from Dol Guldur, Escape from Mount Gram, The Treachery of Rhudaur, The Battle of Carn Dûm, The Dread Realm, Deadmen's Dike |
| Underground | A Journey in the Dark | The Bridge of Khazad Dûm | The Caves of Nibin-Dûm, Mount Gundabad |
| Dragons | Many Meetings | Isengard Unleashed | The King's Quest, The Withered Heath, Fire in the Night, The Ghost of Framsburg, The Fate of Wilderland |
| Sea | The Grey Havens | Helm's Deep | Every Dream-chaser scenario |

Win and loss stings may be cut from The Return of the King (win) and Hope Fails (loss) in place of the `dread.win` and `dread.loss` sound effects.

## Looping

- Each clip is cut with ffmpeg at a phrase boundary, 60 to 120 seconds long, its end crossfaded into its start so the loop has no seam, and encoded to AAC (phone) and Opus (web, desktop) at about 96 kbit/s. The cut points (start, end, crossfade) are kept in code beside the sound picks (`scripts/build/sound-picks.ts`), so a cut is rebuilt from the player's files and reviewed in a diff.
- The built-in `loop` of the player can leave a short gap at each repeat on some platforms. Two players that crossfade at the loop point avoid it; measure first, and keep the simple loop where it has no gap.
- Calm to combat: a 1.5 second crossfade when the Combat phase opens with an enemy engaged, and back when the round ends.
- Size: about 1 MB a minute, so 40 loops at 90 seconds add about 60 MB to each binary.

## Player and settings

- One `expo-audio` player per active loop, beside the sound effects' players (`src/ui/sound/sound.ts`), with the same audio session: the silent switch, mixed with the player's own music, stopped when the app leaves the foreground.
- Settings, the Sound group: Music (on) and a Music volume row (`VolumeSlider`), under Sound effects and Effects volume (user request, 2026-11-21); they show only in a bundle that carries the music.

## Steps

1. The user downloads the three albums.
2. The loop cuts and the scenario map in code, cut and packed by `pnpm assets sounds`.
3. The music player, the per-scenario map and the calm to combat crossfade, with their setting rows and the Sound section (`docs/design-system-table.md`, Sound).

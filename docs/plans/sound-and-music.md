# Plan: the rest of the sound

The sound effects and the music are built (`docs/design-system-table.md`, Sound): the effect slots in `src/ui/sound/slots.ts` with the Darkest Dungeon II event cut for each in `scripts/build/sound-picks.ts`, and the music loops in `src/ui/sound/music-map.ts` with the passage of the film trilogy's score cut for each in `scripts/build/music-picks.ts` (user decisions, 2026-11-21). Both are cut from the player's own files, pinned in `data/sources.json`, kept in the asset mirror and never committed. This plan holds what is still open.

## Decisions

- **Releases carry the audio** (user decision, 2026-11-21): the sound effects and the music are pinned in `data/sources.json` and kept in the asset mirror (`docs/development.md`, Asset mirror), and the release's phone builds pack them.
- **"VFX".** The first request named VFX, but its points were all audio. If visual effects are also meant (card glows, combat particles, phase transitions), they are a separate plan. Open, for the user.
- **Hobbit score.** The Hobbit films' score would fit Mirkwood, Ered Mithrin and the dragon scenarios, outside the stated trilogy. Open, for the user.

## Still open

- The web and the desktop play no sound and no music: `playSound` and the music return there, `bundled.ts` carries no files, and the copies in `scripts/checks/web-copies.test.ts` leave the sound lines and the Sound group out. A desktop branch adds the Sound group to `setting-rows.canvaskit.tsx`, the strikes to `use-spotlight.canvaskit.ts`, the tab sound to `tab-bar.canvaskit.tsx`, a `bundled` map for the web, and starts the audio on the first gesture.
- Effect slots packed but not played: `combat.roar`, `combat.miss`, `card.shuffle`, `card.deal`, `dread.treachery`, `ui.notice`. Each needs a moment the screen shows once (a Nazgûl reveal, a shuffle step, the Setup deal, a treachery's reveal, a banner worth a sound).

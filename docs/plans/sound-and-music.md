# Plan: the rest of the sound

The sound effects and the music are built (`docs/design-system-table.md`, Sound): the effect slots in `src/ui/sound/slots.ts` with the Darkest Dungeon II event cut for each in `scripts/build/sound-picks.ts`, and the music loops in `src/ui/sound/music-map.ts` with the passage of the film trilogy's score cut for each in `scripts/build/music-picks.ts` (user decisions, 2026-11-21). Both are cut from the player's own files, pinned in `data/sources.json`, kept in the asset mirror and never committed. This plan holds what is still open.

## Decisions

- **Releases carry the audio** (user decision, 2026-11-21): the sound effects and the music are pinned in `data/sources.json` and kept in the asset mirror (`docs/development.md`, Asset mirror), and the release's phone builds pack them.
- **"VFX".** The first request named VFX, but its points were all audio. If visual effects are also meant (card glows, combat particles, phase transitions), they are a separate plan. Open, for the user.
- **Hobbit score.** The Hobbit films' score would fit Mirkwood, Ered Mithrin and the dragon scenarios, outside the stated trilogy. Open, for the user.

## Still open

- Effect slots packed but not played: `combat.roar`, `combat.miss`, `card.shuffle`, `card.deal`, `dread.treachery`, `ui.notice`. Each needs a moment the screen shows once (a Nazgûl reveal, a shuffle step, the Setup deal, a treachery's reveal, a banner worth a sound).

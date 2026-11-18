# Plan: sound effects and music

Discovery. Nothing here is built. The app has no audio today: the only feedback beyond the screen is the haptic ticks (`src/ui/haptics.ts`; `docs/design-system-table.md`, Haptics).

## Idea (user request, 2026-11-18)

- Copyrighted material may be used: this is a hobby project.
- Nintendo Switch 2 system sounds for the UI actions that are not gameplay (menus, tabs, toggles, sheets, Back).
- Sounds from existing games for playing cards and for combat: to be found.
- Music: looped segments of the Lord of the Rings film trilogy.

## Decisions for the user

1. **What the public releases carry.** The repository is public and every release is a public GitHub release (`.claude/rules/release-standards.md`, Tags and releases). Card art and booklets already ship inside the binaries. Nintendo audio and film audio are a larger takedown risk: Nintendo files DMCA notices often, and a notice can reach the repository, not only one release asset. Options:
   - A. Releases carry the audio, as they carry the booklets.
   - B. Releases carry no audio; a local or development build packs it from the cache.
   - C. As B, and the player adds their own audio folder in Settings, as a booklet can be added from the player's files.

   Recommendation: C. The pipeline below is the same for all three; only the release workflow's packing step differs.
2. **"VFX".** The request names VFX, but its points are all audio. If visual effects are also meant (card glows, combat particles, phase transitions), they are a separate plan: the table already has token pops, the spotlight's flash, burn and fog (`src/play/spotlight`, `src/play/motion`).

## Where sound plays

Every sound goes through one module, `src/ui/sound.ts`, beside `haptics.ts`, with the same contract: it adds to the screen and never replaces it, a failure is silent, and it plays at the moment its haptic plays. The existing events are the hook points:

| Event | Today | Sound |
| --- | --- | --- |
| Dock button arms, hand scrub card changes | `tickArmed` | UI select (Switch 2) |
| Intent accepted, Undo | `tickSent` | UI confirm (Switch 2) |
| Intent refused, unpaid play, dropped unplayable card | `tickRefused` | UI error (Switch 2) |
| Card from hand lands | `tickLand` | Card place (game) |
| Spotlight hit stop | `tickImpact` | Strike; a kill takes a heavier strike (game) |
| Tab, sheet, panel, Back, toggle, segmented control | none | UI navigation set (Switch 2) |
| Card draw, shuffle, deal at Setup | card motion (`src/play/motion`) | Card draw, shuffle (game) |
| Token added: damage, progress, resource | token pops (`token-fx.ts`, `token-deltas.ts`) | One short sound each (game) |
| Threat dial changes | dial pop | Rise and fall stings (game) |
| Phase change | `railFlash` | Soft chime (game) |
| Encounter card revealed, shadow card dealt, enemy engages | banner beats (`beat-store.ts`) | Reveal, shadow, engage (game) |
| Quest stage advanced, scenario won, scenario lost | quest advance screen, Resolution | Stings (game or film) |

Rules for the sound module, taken from the haptics:

- No sound when a motion is snapped by a touch (Hurry), on a peek, or on a seat handoff (`kindMoves`).
- At most one sound of a kind per new state, as `tickLand`.
- Feedback comes before heavy work (`.claude/rules/code-standards.md`, Rendering the table and screens): the confirm plays on acceptance.
- The spotlight's mute for a screen reader also mutes its sounds.

## Sources

Every file comes from an online source, is pinned by sha256 in `data/sources.json`, is fetched by `pnpm data sync audio` into `.cache/audio/`, and is packed by `pnpm assets audio` into `assets/audio/` (gitignored), as the booklets are (`scripts/build/pack-booklets.ts`). No audio file is committed. `THIRD_PARTY_NOTICES.md` gets an audio section.

### UI: Switch 2 system sounds

- A search (2026-11-18) found no rip of the Switch 2 HOME Menu sounds. Nintendo's own video plays each menu sound in turn, and a GameXplain video compares them with the Switch's: these are the candidate sources, cut by timestamp. [Instant Gaming](https://news.instant-gaming.com/en/articles/12538-these-are-the-sound-effects-from-the-switch-2-main-menu), [Nintendo Soup](https://nintendosoup.com/video-comparison-of-the-switch-2-and-switch-home-menu-sound-effects/).
- A video source has a background bed and compression. Each cut is checked by ear; a sound with speech or music under it is dropped.
- Still to find: a clean rip (The Sounds Resource, game-rip archives) once one exists.

### Gameplay: card and combat sounds

Candidates, in order of fit. None is checked yet.

1. **The Lord of the Rings: Adventure Card Game** (Asmodee Digital, 2019): the digital version of this game, so its card, token, threat and combat sounds match the table. No rip was found in the search; the next step is the game's own files (Unity asset bundles) or The Sounds Resource.
2. **Hearthstone**: a large, clean set of card draw, play, shuffle and hit sounds.
3. **The Lord of the Rings Online** and **The Battle for Middle-earth II**: swords, shields, orcs and trolls for the combat spotlight.
4. **Inscryption**, **Slay the Spire**: card handling and soft stings.

The full set is about 25 short sounds. One source for the card sounds and one for combat keep the mix consistent.

### Music: the film trilogy

- Source: Howard Shore's score from the three films, from the soundtrack albums (The Complete Recordings), not from the film's mixed audio track, which carries dialogue and effects.
- Each scenario gets a calm loop and a combat loop, cut from the cue that scores the same place in the film. The Fellowship of the Ring saga's scenario names follow the film's scenes: A Shadow of the Past (the Shire), A Knife in the Dark (Weathertop), Flight to the Ford, The Ring Goes South (Hollin and Caradhras), Journey in the Dark (Moria and the Bridge), Breaking of the Fellowship (Amon Hen). The Two Towers and The Return of the King saga scenarios map the same way.
- Boxes with no film scene (Mirkwood, Dream-chaser, Ered Mithrin, Angmar Awakened) take loops by mood: elven cues for Mirkwood and Lothlórien places, Moria cues for underground, Isengard and Mordor cues for battles. The Hobbit films' score is a candidate for Mirkwood and Ered Mithrin, outside the stated trilogy: a user decision.
- The campaign list and the root screens play one menu loop.
- A scenario's music map is data: `data/audio/music.json`, each scenario id to its calm and combat clip ids, so `pnpm data check` covers it.

## Looping

- Each clip is cut with ffmpeg at a phrase boundary, 60 to 120 seconds long, its end crossfaded into its start so the loop has no seam, and encoded to AAC (phone) and Opus (web, desktop) at about 96 kbit/s. The cut points (start, end, crossfade) are in `data/audio/clips.json`, so a cut is rebuilt from its pinned source and reviewed in a diff.
- The built-in `loop` of the player can leave a short gap at each repeat on some platforms. Two players that crossfade at the loop point avoid it; measure first, and keep the simple loop where it has no gap.
- Calm to combat: a 1.5 second crossfade when the Combat phase opens with an enemy engaged, and back when the round ends.
- Size: about 1 MB a minute, so 40 loops at 90 seconds add about 60 MB to each binary.

## Stack

- `expo-audio`, the SDK 58 `pnpm expo install` version: Android, iOS and web (and so the desktop) are supported. `expo-av` is not used. The Stack table in `docs/brief.md` gets its row when the work starts.
- Short sounds are preloaded once per screen and reused; the music has one player per active loop.
- iOS: sounds follow the silent switch; music stops when the app leaves the foreground.
- Web and desktop: the browser blocks audio before the first gesture, so audio starts on the first tap.
- No sound needs the network at runtime, and no data leaves the device, so `PRIVACY.md` does not change.

## Settings

Motion and feel gains: Sound effects (on), UI sounds (on), Music (on), Music volume and Effects volume. They sit beside Haptics (`docs/design-system.md`, Settings) and are stored with the other table settings (`src/ui/table-settings.ts`).

## Steps

1. User decisions above (release packing, VFX, Hobbit cues).
2. Find and pin the sources: one UI set, one card set, one combat set, the three score albums. Record each in `data/sources.json`.
3. `pnpm data sync audio`, `data/audio/clips.json`, `data/audio/music.json`, and the ffmpeg cut and pack step (`pnpm assets audio`).
4. `src/ui/sound.ts` and the settings rows; the UI sounds on the haptic events.
5. Gameplay sounds on the motion, token, dial, banner and spotlight events.
6. Music player, the per-scenario map and the calm to combat crossfade.
7. `docs/design-system-table.md` gets a Sound section beside Haptics; `docs/architecture.md` says where the sound module sits.

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

Every file names the online page it came from and is pinned by sha256 in `data/sources.json`; `pnpm data sync audio` copies it from the user's download folder into `.cache/audio/` and checks the sha256, and it and is packed by `pnpm assets audio` into `assets/audio/` (gitignored), as the booklets are (`scripts/build/pack-booklets.ts`). No audio file is committed. `THIRD_PARTY_NOTICES.md` gets an audio section.

The user downloads the files by hand (user decision, 2026-11-20): The Sounds Resource answers automated requests with a bot challenge. The list is under Download list.

### UI: Switch system sounds

- The Switch 2 HOME Menu sounds have no rip found yet. Candidates: a cut from Nintendo's own video of the menu sounds ([Instant Gaming](https://news.instant-gaming.com/en/articles/12538-these-are-the-sound-effects-from-the-switch-2-main-menu)), or a dump from the user's own console where its firmware still allows one.
- The Switch 1 HOME Menu sounds are a different set (most Switch 2 sounds were remade, [Nintendo Soup](https://nintendosoup.com/video-comparison-of-the-switch-2-and-switch-home-menu-sound-effects/)). Candidates: a rip on The Sounds Resource, or a dump from the user's own Switch 1 (Atmosphère, hactool, then the HOME Menu's sound archive; SoundNX lists the system sound paths).
- A cut from a video is checked by ear; a sound with speech or music under it is dropped.

### Gameplay: card, token, combat and dread sounds

One game for each kind, so the mix stays consistent. First choice, then the fallback:

The Sounds Resource has no rip of the LOTR Adventure Card Game, Gwent or Shadow of Mordor and Shadow of War (a search of the site, 2026-11-20). The sources that exist:

| Kind | Source | Fallback |
| --- | --- | --- |
| UI | [HOME Menu, Menu Sounds](https://sounds.spriters-resource.com/nintendo_switch/systembios/asset/411814/) (Switch 1; no Switch 2 rip yet) | A cut from Nintendo's Switch 2 video |
| Cards | [Bicycle Board / Card Games, General Sounds](https://sounds.spriters-resource.com/pc_computer/bicycleboardcardgames/asset/565561/) (real cards: shuffle, deal, place) | [Hearthstone, Board](https://sounds.spriters-resource.com/pc_computer/hearthstone/asset/397108/) and [General](https://sounds.spriters-resource.com/pc_computer/hearthstone/asset/396767/) Sound Effects |
| Tokens | [Balatro, Sound Effects](https://sounds.spriters-resource.com/pc_computer/balatro/asset/452647/) | Hearthstone, General Sound Effects |
| Combat | [The Battle for Middle-earth](https://sounds.spriters-resource.com/pc_computer/lordoftheringsbattleformiddleearth/) (its unit and creature pages) | [The Witcher 3](https://sounds.spriters-resource.com/pc_computer/thewitcher3wildhunt/) (its monster pages) |
| Dread and stings | [Darkest Dungeon](https://sounds.spriters-resource.com/pc_computer/darkestdungeon/) (its sound effect pages, not the narrator) | The Battle for Middle-earth |

### Music: the film trilogy

- Source: Howard Shore's score, from the three original soundtrack albums or The Complete Recordings, not from a film's mixed audio track, which carries dialogue and effects.
- Each scenario gets a calm loop and a combat loop, cut from the cue that scores the same place in the film; the boxes with no film scene take loops by mood (Download list, Music).
- The Hobbit films' score would fit Mirkwood and Ered Mithrin, outside the stated trilogy: a user decision.
- A scenario's music map is data: `data/audio/music.json`, each scenario id to its calm and combat clip ids, so `pnpm data check` covers it.

## Chosen sound effects

Every sound effect comes from Darkest Dungeon II (user decision, 2026-11-21), taken from the user's own install: the banks named below, unpacked with vgmstream and sent as Opus. `combat.engage`, `combat.miss` and `combat.enemy-death` are slots that set adds. Darkest Dungeon II has no card sounds, so the card slots use its item, skill and hero handling sounds; the Bicycle card set is the fallback if they sound wrong in play.

Each pick is trimmed after its tail, faded out and levelled by kind (UI at -24 LUFS, cards and tokens at -22, stings at -18, combat at -17, except the enemy death at -21), then encoded as mono AAC (`.m4a`, which the phone, the web and the desktop all play). The built files and `manifest.json` (each file's sha256, and its source bank, event and sha256) are in `.cache/audio/sfx/`, not committed.

| Slot | Darkest Dungeon II event | Bank |
| --- | --- | --- |
| `ui.select` | `ui_shared_mouseover_v2` | `ui.bank` |
| `ui.confirm` | `ui_shared_mouseclick` | `ui.bank` |
| `ui.back` | `ui_shared_back` | `ui.bank` |
| `ui.error` | `ui_shared_invalid` | `ui.bank` |
| `ui.toggle-on` | `ui_shared_skill_equip_v2` | `ui.bank` |
| `ui.toggle-off` | `ui_shared_skill_unequip_v2` | `ui.bank` |
| `ui.tab` | `ui_shared_tab` | `ui.bank` |
| `ui.open` | `ui_shared_menu_open` | `ui.bank` |
| `ui.close` | `ui_shared_menu_close` | `ui.bank` |
| `ui.notice` | `ui_shr_text_popup` | `ui.bank` |
| `card.draw` | `ui_rewards_item_appear` | `ui.bank` |
| `card.pick` | `ui_heroselect_pickup` | `ui.bank` |
| `card.land` | `ui_heroselect_add` | `ui.bank` |
| `card.shuffle` | `ui_heroselect_path_gen` | `ui.bank` |
| `card.deal` | `ui_battle_turnorder_reveal` | `ui.bank` |
| `card.flip` | `ui_inn_quirk_reveal_neg` | `ui.bank` |
| `card.discard` | `ui_shared_discard` | `ui.bank` |
| `card.exhaust` | `ui_embark_unhighlight` | `ui.bank` |
| `card.ready` | `ui_embark_highlight` | `ui.bank` |
| `token.resource` | `ui_rewards_take_currency_gold` | `ui.bank` |
| `token.damage` | `sfx_battle_status_bleedDOT` | `battle.bank` |
| `token.progress` | `ui_eor_candle_count` | `ui.bank` |
| `token.remove` | `ui_shared_wheel_lose` | `ui.bank` |
| `combat.engage` | `ui_battle_start` | `ui.bank` |
| `combat.roar` | `sfx_monster_ghoul_howl_use` | `shared_enemy.bank` |
| `combat.strike` | `sfx_monster_footsoldier_cut_use` | `shared_enemy.bank` |
| `combat.block` | `sfx_hero_meleeA_guard_use` | `shared_hero.bank` |
| `combat.miss` | `sfx_hero_meleeA_atk_miss` | `shared_hero.bank` |
| `combat.kill` | `sfx_battle_crit_hero` | `battle.bank` |
| `combat.enemy-death` | `sfx_battle_execution` | `battle.bank` |
| `dread.threat-up` | `sfx_battle_status_stressup` | `battle.bank` |
| `dread.threat-down` | `sfx_battle_status_stressdown` | `battle.bank` |
| `dread.danger` | `sfx_battle_deathsdoor` | `battle.bank` |
| `dread.shadow` | `sfx_battle_status_horror` | `battle.bank` |
| `dread.treachery` | `sfx_battle_status_debuff` | `battle.bank` |
| `dread.phase` | `sfx_battle_switch` | `battle.bank` |
| `dread.stage` | `ui_battle_dungeon_next` | `battle.bank` |
| `dread.win` | `ui_eor_results` | `ui.bank` |
| `dread.loss` | `ui_driving_torchlight_out` | `ui.bank` |

## Download list

Save each file under one folder, in the subfolder and with the name given here (the extension is whatever the source gives: WAV or FLAC first, else the best quality offered). A row with two names wants two or three takes of the sound, saved as `-1`, `-2`, `-3`, so a repeat does not sound the same each time. Keep a `sources.txt` in each subfolder: the page URL each file came from.

### `ui/` (Switch 1 HOME Menu, until a Switch 2 rip exists)

| File | The sound |
| --- | --- |
| `ui.select` | The cursor moving to another icon or row |
| `ui.confirm` | A press on an item (A) |
| `ui.back` | Back (B) |
| `ui.error` | The "cannot do that" sound |
| `ui.toggle-on`, `ui.toggle-off` | A settings switch turned on and off |
| `ui.tab` | A category or tab change (L, R) |
| `ui.open`, `ui.close` | A menu or panel opening and closing (Quick Settings, the Home button menu) |
| `ui.notice` | A pop-up notification |

### `cards/` (Bicycle Board / Card Games, else Hearthstone)

| File | The sound |
| --- | --- |
| `card.draw-1..3` | A card drawn from the deck to the hand |
| `card.pick` | A card lifted from the hand |
| `card.land-1..3` | A card set down on the table |
| `card.shuffle` | A deck shuffled |
| `card.deal` | Several cards dealt in a row (the Setup) |
| `card.flip` | A card turned faceup (an encounter card revealed) |
| `card.discard` | A card sent to the discard pile |
| `card.exhaust`, `card.ready` | A card turned sideways and back (a slide or tap) |

### `tokens/` (Balatro, else Hearthstone)

| File | The sound |
| --- | --- |
| `token.resource-1..3` | A chip or coin added |
| `token.damage` | A heavier token or a hit thud |
| `token.progress` | A lighter, brighter token |
| `token.remove` | Tokens cleared off a card |

### `combat/` (The Battle for Middle-earth, else The Witcher 3)

| File | The sound |
| --- | --- |
| `combat.strike-1..3` | A sword or weapon hit on flesh or armour |
| `combat.block` | A strike stopped by a shield |
| `combat.kill` | A killing blow, heavier than a strike |
| `combat.orc` | An orc or Uruk roar or grunt (an enemy engages) |
| `combat.troll` | A troll roar (a large enemy) |
| `combat.nazgul` | A Nazgûl scream (a Nazgûl revealed; BFME has the best one) |

### `dread/` (Darkest Dungeon, else The Battle for Middle-earth)

| File | The sound |
| --- | --- |
| `dread.threat-up` | A low, ominous rise |
| `dread.threat-down` | A short relief chord |
| `dread.danger` | A tense warning (threat near elimination) |
| `dread.shadow` | A shadow card dealt to an enemy |
| `dread.treachery` | A treachery card revealed |
| `dread.phase` | A soft chime or bell (a phase change) |
| `dread.stage` | A quest stage advanced |
| `dread.win`, `dread.loss` | A short victory and defeat sting |

### `music/` (the three soundtrack albums)

Download the three albums whole: The Fellowship of the Ring, The Two Towers and The Return of the King (the original soundtracks, or The Complete Recordings). Name each file as it comes, with its track number. The track titles below are the original soundtrack's; check them against the album downloaded, and use the Complete Recordings cue of the same scene where it has one. Each row is the calm loop, then the combat loop.

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

Win and loss stings may be cut from The Return of the King (win) and Hope Fails (loss) in place of `dread.win` and `dread.loss`.

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
2. The user downloads the files on the Download list. Record each in `data/sources.json` with its page URL and sha256.
3. `pnpm data sync audio`, `data/audio/clips.json`, `data/audio/music.json`, and the ffmpeg cut and pack step (`pnpm assets audio`).
4. `src/ui/sound.ts` and the settings rows; the UI sounds on the haptic events.
5. Gameplay sounds on the motion, token, dial, banner and spotlight events.
6. Music player, the per-scenario map and the calm to combat crossfade.
7. `docs/design-system-table.md` gets a Sound section beside Haptics; `docs/architecture.md` says where the sound module sits.

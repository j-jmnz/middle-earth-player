// The sound chosen for each slot (docs/design-system-table.md, Sound): a Darkest Dungeon II event, by its bank and its name as vgmstream
// writes it, unpacked from the player's own install (user decision, 2026-11-21), or, where `game` says so, a Hearthstone sound by its
// file name in the player's rip (the card landing; user choice, 2026-11-21). `lufs` is the loudness the file is levelled to and
// `maxSeconds` the longest it is kept; each group shares both unless a slot names its own. `onset`: the share of the sound's peak its
// cut starts at, for a pick that leads in quietly before its hit, so the hit is heard at the moment it is played; without it the cut
// starts where the silence ends (pack-sounds.ts, soundStart). `pnpm assets sounds --check` lists how long each packed sound takes to rise.
import type { SoundSlot } from "../../src/ui/sound/slots.ts";

export type SoundPick = { game?: "hearthstone"; bank: string; event: string; lufs: number; maxSeconds: number; onset?: number };

const ui = { lufs: -24, maxSeconds: 0.8 };
const card = { lufs: -22, maxSeconds: 1.4 };
const token = { lufs: -22, maxSeconds: 1.2 };
const combat = { lufs: -17, maxSeconds: 3 };
const dread = { lufs: -18, maxSeconds: 4.5 };

export const SOUND_PICKS: Record<SoundSlot, SoundPick> = {
  "ui.select": { bank: "ui", event: "ui_shared_mouseover_v2", ...ui },
  "ui.confirm": { bank: "ui", event: "ui_shared_mouseclick", ...ui },
  "ui.back": { bank: "ui", event: "ui_shared_back", ...ui },
  "ui.error": { bank: "ui", event: "ui_shared_invalid", ...ui },
  "ui.toggle-on": { bank: "ui", event: "ui_shared_skill_equip_v2", ...ui },
  "ui.toggle-off": { bank: "ui", event: "ui_shared_skill_unequip_v2", ...ui },
  "ui.tab": { bank: "ui", event: "ui_shared_tab", ...ui },
  "ui.open": { bank: "ui", event: "ui_shared_menu_open", ...ui },
  "ui.close": { bank: "ui", event: "ui_shared_menu_close", ...ui, onset: 0.3 },
  "ui.notice": { bank: "ui", event: "ui_shr_text_popup", ...ui },
  "ui.unfold": { bank: "ui", event: "ui_inn_storage_open", ...ui },
  "ui.fold": { bank: "ui", event: "ui_inn_storage_close", ...ui },
  // A card picked on the table and one put back: taps made many times a moment, so a dull click, quieter than the buttons (user request, 2026-11-22).
  "ui.pick": { bank: "ui", event: "ui_shared_minorclick", ...ui, lufs: -29 },
  "ui.unpick": { bank: "ui", event: "ui_shared_minorclick_back", ...ui, lufs: -29 },
  "card.draw": { bank: "ui", event: "ui_rewards_item_appear", ...card },
  "card.pick": { bank: "ui", event: "ui_heroselect_pickup", ...card },
  "card.land": { game: "hearthstone", bank: "", event: "credits_card_enter_1", ...card, onset: 0.3 },
  "card.shuffle": { bank: "ui", event: "ui_heroselect_path_gen", ...card },
  "card.deal": { bank: "ui", event: "ui_battle_turnorder_reveal", ...card },
  "card.flip": { bank: "ui", event: "ui_inn_quirk_reveal_neg", ...card },
  "card.discard": { bank: "ui", event: "ui_shared_discard", ...card },
  "card.exhaust": { bank: "ui", event: "ui_embark_unhighlight", ...card },
  "card.ready": { bank: "ui", event: "ui_embark_highlight", ...card },
  "token.resource": { bank: "ui", event: "ui_rewards_take_currency_gold", ...token },
  "token.damage": { bank: "battle", event: "sfx_battle_status_bleedDOT", ...token },
  "token.progress": { bank: "ui", event: "ui_eor_candle_count", ...token },
  "token.remove": { bank: "ui", event: "ui_shared_wheel_lose", ...token },
  "combat.engage": { bank: "ui", event: "ui_battle_start", ...combat },
  "combat.roar": { bank: "shared_enemy", event: "sfx_monster_ghoul_howl_use", ...combat },
  "combat.strike": { bank: "shared_enemy", event: "sfx_monster_footsoldier_cut_use", ...combat },
  "combat.block": { bank: "shared_hero", event: "sfx_hero_meleeA_guard_use", ...combat },
  "combat.miss": { bank: "shared_hero", event: "sfx_hero_meleeA_atk_miss", ...combat },
  "combat.kill": { bank: "battle", event: "sfx_battle_crit_hero", ...combat, onset: 0.25 },
  // Softer than the kill it plays with at the same hit stop (user choice, 2026-11-21).
  "combat.enemy-death": { bank: "battle", event: "sfx_battle_execution", ...combat, lufs: -21 },
  "dread.threat-up": { bank: "battle", event: "sfx_battle_status_stressup", ...dread },
  "dread.threat-down": { bank: "battle", event: "sfx_battle_status_stressdown", ...dread },
  "dread.danger": { bank: "battle", event: "sfx_battle_deathsdoor", ...dread },
  "dread.shadow": { bank: "battle", event: "sfx_battle_status_horror", ...dread },
  "dread.treachery": { bank: "battle", event: "sfx_battle_status_debuff", ...dread },
  "dread.phase": { bank: "battle", event: "sfx_battle_switch", ...dread, onset: 0.2 },
  "dread.stage": { bank: "battle", event: "ui_battle_dungeon_next", ...dread },
  "dread.win": { bank: "ui", event: "ui_eor_results", ...dread },
  "dread.loss": { bank: "ui", event: "ui_driving_torchlight_out", ...dread },
};

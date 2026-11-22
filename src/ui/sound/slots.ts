// The sound effect slots (docs/design-system-table.md, Sound): one short sound for each kind of moment, named by group. The files are
// packed into assets/sounds as `<slot>.m4a` (scripts/build/pack-sounds.ts); a build without them plays none.
export const SOUND_SLOTS = [
  "ui.select",
  "ui.confirm",
  "ui.back",
  "ui.error",
  "ui.toggle-on",
  "ui.toggle-off",
  "ui.tab",
  "ui.open",
  "ui.close",
  "ui.notice",
  "card.draw",
  "card.pick",
  "card.land",
  "card.shuffle",
  "card.deal",
  "card.flip",
  "card.discard",
  "card.exhaust",
  "card.ready",
  "token.resource",
  "token.damage",
  "token.progress",
  "token.remove",
  "combat.engage",
  "combat.roar",
  "combat.strike",
  "combat.block",
  "combat.miss",
  "combat.kill",
  "combat.enemy-death",
  "dread.threat-up",
  "dread.threat-down",
  "dread.danger",
  "dread.shadow",
  "dread.treachery",
  "dread.phase",
  "dread.stage",
  "dread.win",
  "dread.loss",
] as const;

export type SoundSlot = (typeof SOUND_SLOTS)[number];

// The sounds kept loaded so they start with no wait (sound.ts, primeSounds; each list fits PLAYERS_MAX): the ones the screens play,
// from launch and again when the table closes, and the ones the table plays most, while it is open. Any other sound is loaded as its
// moment is known to come, or the first time it plays.
export const SCREEN_SOUNDS: readonly SoundSlot[] = ["ui.confirm", "ui.back", "ui.select", "ui.tab", "ui.open", "ui.close", "ui.toggle-on", "ui.toggle-off", "ui.error", "ui.notice"];
export const TABLE_SOUNDS: readonly SoundSlot[] = ["ui.select", "ui.confirm", "ui.toggle-off", "ui.back", "card.pick", "card.land", "card.draw", "card.exhaust", "card.ready", "token.resource", "token.damage", "token.progress"];

export function isSoundSlot(name: string): name is SoundSlot {
  return (SOUND_SLOTS as readonly string[]).includes(name);
}

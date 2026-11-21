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

export function isSoundSlot(name: string): name is SoundSlot {
  return (SOUND_SLOTS as readonly string[]).includes(name);
}

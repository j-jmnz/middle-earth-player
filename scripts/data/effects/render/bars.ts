// Barred effects. A flag one record sets on a card (a ModifyStat of a flag stat) can stop another verb of that card: while `noResourcesPlaced` is held, PlaceResourceTokens on the card places nothing.
// An optional ability (Response, Action) whose whole effect is barred must not be offered then, so the render says, per record, whether it is. The table lists the flags that bar a verb; each reader is named in the flag's comment in src/catalog/families/*.ts (FLAGS).
import { compact, isObj, str, type Ctx, type Obj } from "./kit.ts";

// flag -> the verb it bars and the field that names the card the verb acts on (`self`: the record's own card).
export const BARS: Readonly<Record<string, { verb: string; holder: string }>> = {
  noResourcesPlaced: { verb: "PlaceResourceTokens", holder: "on" },
};

// The records that set the flag on the card being rendered: a ModifyStat of the flag whose holders name the card (or that holds it by `target: self`).
function setters(flag: string, ctx: Ctx): string[] {
  return (ctx.effects ?? []).flatMap((effect) => {
    const instructions = Array.isArray(effect.instructions) ? effect.instructions : [];
    const sets = instructions.some((ins) => isObj(ins) && ins.verb === "ModifyStat" && ins.stat === flag && isObj(ins.holders) && Array.isArray(ins.holders.names) && ins.holders.names.includes(ctx.cardName));
    return sets ? [str(effect.id)] : [];
  });
}

// A note for a record whose whole effect is a barred verb on its own card, or "" when none applies.
export function barNote(effect: Obj, ctx: Ctx): string {
  const instructions = Array.isArray(effect.instructions) ? effect.instructions : [];
  if (instructions.length === 0 || effect.timing === "constant") return "";
  const notes: string[] = [];
  for (const [flag, bar] of Object.entries(BARS)) {
    const whole = instructions.every((ins) => isObj(ins) && ins.verb === bar.verb && ins[bar.holder] === "self");
    const by = whole ? setters(flag, ctx) : [];
    if (by.length === 0) continue;
    const guarded = compact(effect.condition ?? null).includes(`"stat":"${flag}"`);
    notes.push(guarded ? `its whole effect is barred by the flag ${flag} (set by ${by.join(", ")}) and the record is NOT offered while it bars` : `its whole effect is barred by the flag ${flag} (set by ${by.join(", ")}) and the record has NO condition on it: it IS OFFERED EVEN WHILE ${flag} BARS ITS EFFECT`);
  }
  return notes.join("; ");
}

// What the family files share: the template shapes and the words for an amount, a pick and the player a verb names.
import { renderAmount } from "./amounts.ts";
import { str, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";

export type Made = { text: string; read: readonly string[] };
export type Templates = Readonly<Record<string, (i: Obj, ctx: Ctx) => Made>>;
export type ConditionTemplates = Readonly<Record<string, (c: Obj, ctx: Ctx) => Made>>;
export type Samples = Readonly<Record<string, readonly Obj[]>>;

export const amt = (value: unknown, ctx: Ctx): string => renderAmount(value, ctx, renderPick);
export const pck = (value: unknown, ctx: Ctx): string => renderPick(value, ctx);

export const WHO: Readonly<Record<string, string>> = { actor: "the acting player", firstPlayer: "the first player", picked: "the picked player", eventSeat: "the player the event is about", eachSeat: "each player", guardian: "the player guarding Gollum", defendingPlayer: "the defending player (the player this enemy is engaged with)" };
export const who = (value: unknown): string => WHO[str(value)] ?? str(value);

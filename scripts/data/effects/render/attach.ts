// The templates of the verbs that put an encounter card on a host or spend a resource from one card's pool: AttachSelf (the host it is offered to, and `announces`) and SpendResources with a `target` (04016:A:1). The other SpendResources lines (a hero chosen for each resource) are in core-verbs.ts.
import { cardRef, renderAmount } from "./amounts.ts";
import { renderPick } from "./picks.ts";
import { isObj, str, type Ctx, type Obj } from "./kit.ts";
import { CORE_TEMPLATES } from "./families/core-verbs.ts";

type Made = { text: string; read: readonly string[] };

const attachSelfText = (i: Obj): Made | null => (isObj(i.to) && i.to.kind === "character" ? { text: `attach this card to ${typeof i.to.name === "string" ? `the character titled "${i.to.name}"` : `a ${typeof i.to.trait === "string" ? `${i.to.trait} ` : ""}character of any player (the first player chooses it)`}${i.to.unlimited === true ? " (any number of copies may be attached)" : " that carries no copy of this card"}; with none this card is discarded`, read: ["to"] } : isObj(i.to) && i.to.kind === "hero" ? { text: `attach this card to ${i.to.control === "firstPlayer" ? `a hero the first player controls${i.to.unlimited === true ? ", one that carries a copy of this card too" : " that has no copy of this card attached"} (the first player chooses it; with none this card is discarded)` : typeof i.to.trait === "string" ? `a ${i.to.trait} hero` : `a hero${typeof i.to.minWillpower === "number" ? ` with ${i.to.minWillpower} or more Willpower` : ""}${i.to.control === "you" ? " the acting player controls that carries no copy of this card (the acting player, the first player in a When Revealed, chooses it; with none this card stays where it is)" : ""}${i.to.control === "any" ? " of any player (the first player chooses among those that carry no copy of this card; with none this card stays where it is)" : ""}`}`, read: ["to"] } : null);

export const ATTACH_TEMPLATES: Readonly<Record<string, (i: Obj, ctx: Ctx) => Made | null>> = {
  AttachSelf: (i, ctx) => {
    if (isObj(i.to) && i.to.kind === "enemy") return { text: `attach this card to an enemy in play with the trait ${str(i.to.trait)}${i.to.challenge === true ? " (the opposing team attaches it, so nobody is asked: the enemy with the most hit points left)" : ""}`, read: ["to"] };
    if (isObj(i.to) && i.to.kind === "character" && i.to.control === "mostAttachments") return { text: "attach this card to the character of any player with the most attachments, among those that carry no copy of this card (the first player chooses among those tied); with none this card is discarded", read: ["to"] };
    const made = attachSelfText(i);
    if (made === null) return CORE_TEMPLATES.AttachSelf?.(i, ctx) ?? null;
    return i.announces === true ? { text: `${made.text} (the attachment is announced as it attaches: a Forced effect on an attachment hears it)`, read: [...made.read, "announces"] } : made;
  },
  SpendResources: (i, ctx) => (i.target === undefined ? (CORE_TEMPLATES.SpendResources?.(i, ctx) ?? null) : { text: `${renderAmount(i.amount, ctx, renderPick)} resource(s) are spent from the resource pool of ${cardRef(i.target)} (nothing is spent when the pool holds fewer)`, read: ["amount", "target"] }),
};

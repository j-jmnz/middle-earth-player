// Rules: rr.ownership-and-control, rr.first-player, rr.action, rr.response, rr.limits, rr.lasting-effects, rr.resource-match,
// rr.triggered-ability, rr.optional-engagement, rr.engagement-check, rr.step-3-2, rr.step-5-3, rr.step-6-4a, rr.attachment-cards
// (data/rules/entries.json).
// The Mountain of Fire heroes, allies and attachments, each printed line tested from the words on the card: Aragorn 146002:A:1 and A:2,
// Éomer 146003:A:1, Tom Cotton 146004:A:1 and A:2, Rosie Cotton 146005:A:1, Elladan 146007:A:1, Elrohir 146008:A:1 and A:2, Orc
// Disguise 146009:A:1 to A:3, Gúthwinë 146011:A:1. The lines of 146002, 146005, 146007 and 146008 are in
// data/printed/the-return-of-the-king.json; the others have no ledger entry, so their lines are the text of data/cards/MoF.json and
// the steps go through sendUnledgered. The events are in the-mountain-of-fire-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents, legalTargets } from "../../rules/engine/reduce.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, FRODO, idsOf, SAM, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN_CORE = "01001";
const THEODRED = "01002";
const EOWYN = "01007";
const SCOUT = "01016";
const ARAGORN = "146002";
const EOMER = "146003";
const TOM = "146004";
const ROSIE = "146005";
const ELLADAN = "146007";
const ELROHIR = "146008";
const DISGUISE = "146009";
const CAPTAINS = "146010";
const GUTHWINE = "146011";
// Stand-ins: an Orc and a plain enemy whose engagement cost equals the test threat (8), a weak enemy, a Leadership Hobbit ally.
const ORC = "orc";
const MAN = "man";
const SOFT = "soft";
const HOBBIT = "hobbit";
const CHEAP = "cheap";
const DEAR = "dear";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN_CORE, THEODRED, EOWYN, SCOUT, ARAGORN, EOMER, TOM, ROSIE, ELLADAN, ELROHIR, DISGUISE, CAPTAINS, GUTHWINE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 8, attack: 2, defense: 0, health: 9 }));
  cards.set(MAN, definePrinted({ code: MAN, name: "Man", type: "enemy", traits: ["Brigand"], threat: 1, engagementCost: 8, attack: 2, defense: 0, health: 9 }));
  cards.set(SOFT, definePrinted({ code: SOFT, name: "Soft", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(HOBBIT, definePrinted({ code: HOBBIT, name: "Hobbit", type: "ally", traits: ["Hobbit"], sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 1 }));
  base = { ...starter, cards };
});

function play(run: Run, tab: Table, cardId: string, hostId?: string): Run {
  return sendUnledgered(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId), ...(hostId ? { hostId } : {}) }, tab.ctx);
}

function hosts(tab: Table, cardId: string): string[] {
  return [...legalTargets(tab.state, { type: "PlayCard", cardId }, tab.ctx)].sort();
}

// The engine moves on to `mode` (its phase begins) and runs to its next window.
function enter(state: ScenarioState, tab: Table, mode: Parameters<typeof withMode>[1]): Run {
  return begin(settle({ ...withMode(state, mode), window: null }, tab.ctx, []));
}

// The end of the round: its action window is passed, so the round ends.
function endRound(state: ScenarioState, tab: Table): Run {
  let run = enter(state, tab, "endRound");
  for (let guard = 0; guard < 10 && run.state.window?.kind === "frameAction"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
  return run;
}

const printed = (tab: Table, code: string, which: "attack" | "defense" | "willpower"): number => tab.ctx.cards.get(code)?.[which] ?? 0;

// The enemies that attack in the combat phase that follows: each defence window is answered undefended with Sam.
function attacks(state: ScenarioState, tab: Table): string[] {
  let run = enter(state, tab, "enemyAttacks");
  const seen: string[] = [];
  const passable = (next: ScenarioState) => legalIntents(next, tab.ctx).some((intent) => intent.type === "Pass");
  for (let guard = 0; guard < 10 && run.state.window != null && run.state.mode === "enemyAttacks" && (run.state.window.kind === "defense" || passable(run.state)); guard += 1) {
    const window = run.state.window;
    if (window.kind === "defense") seen.push(window.enemyId);
    run = sendUnledgered(run, window.kind === "defense" ? { type: "Undefended", heroId: idsOf(tab, SAM) } : { type: "Pass" }, tab.ctx);
  }
  return [...seen, ...run.steps.flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.enemyId] : []))];
}

describe("Aragorn (146002:A:1, A:2)", () => {
  // "Sentinel. The first player gains control of Aragorn." (the keyword is the card's own)
  lineSpec("146002:A:1", "Aragorn: the first player takes control of him", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: TOM, seat: 0 }, { code: ARAGORN, seat: 1 }, { code: PAL, seat: 1 }] });
    const aragorn = idsOf(tab, ARAGORN);
    let run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[aragorn]?.controller).toBe(0);
    expect(run.state.seats[0]?.heroes).toContain(aragorn);
    run = sendUnledgered(begin({ ...run.state, firstPlayer: 1 }), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[aragorn]?.controller).toBe(1);
  });

  // "Action: Spend 1 resource from Aragorn's pool to ready him. (Limit once per phase.)"
  lineSpec("146002:A:2", "Aragorn: spend 1 resource from his pool to ready him, once per phase", (effects) => {
    const scene = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: TOM, seat: 0 }] }, 2);
    const aragorn = idsOf(scene, ARAGORN);
    const tab = { ...scene, state: updateCard(scene.state, aragorn, { exhausted: true }) };
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: aragorn, effectId: "146002:action:1", payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[aragorn]).toMatchObject({ exhausted: false, resources: 1 });
    expect(run.state.cards[idsOf(tab, TOM)]?.resources).toBe(2);
    expect(triggers(updateCard(run.state, aragorn, { exhausted: true }), tab)).not.toContain("146002:action:1");
  });

  it("146002:A:2 Aragorn: not offered with an empty pool", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: TOM, seat: 0 }] }, 0);
    expect(triggers(updateCard(scene.state, idsOf(scene, ARAGORN), { exhausted: true }), scene)).not.toContain("146002:action:1");
  });

  // FAULT: readying a ready Aragorn changes nothing, so the Action cannot be initiated (rr.triggered-ability); the engine offers it and
  // would take his resource for nothing.
  it.fails("146002:A:2 Aragorn: not offered while he is ready", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: TOM, seat: 0 }] }, 1);
    expect(triggers(scene.state, scene)).not.toContain("146002:action:1");
  });
});

describe("Éomer (146003:A:1)", () => {
  // "Response: After Éomer commits to the quest, spend 1 resource from his resource pool to immediately declare him as an attacker
  // (and resolve his attack) against an enemy in the staging area.": committing exhausts him and an exhausted character is not declared
  // as an attacker, so Captains of the West (Éomer is Noble) keeps him ready. Éomer (3 Attack) attacks the Soft enemy (0 Defense) in the
  // staging area, not the enemy engaged with the player.
  lineSpec("146003:A:1", "Éomer: after he commits, spend 1 resource to attack an enemy in the staging area", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: EOMER, seat: 0 }, { code: ARAGORN_CORE, seat: 0 }], staging: [SOFT], engaged: [{ code: DEAR, seat: 0 }], hand: [{ code: CAPTAINS, seat: 0 }] }, 0);
    const [eomer, soft, dear] = [idsOf(tab, EOMER), idsOf(tab, SOFT), idsOf(tab, DEAR)];
    const funded = { ...tab, state: updateCard(updateCard(tab.state, eomer, { resources: 1 }), idsOf(tab, ARAGORN_CORE), { resources: 3 }) };
    let run = sendUnledgered(begin(funded.state), { type: "PlayCard", cardId: idsOf(tab, CAPTAINS), payments: [{ heroId: idsOf(tab, ARAGORN_CORE), amount: 3 }] }, tab.ctx);
    run = sendUnledgered(run, { type: "Commit", cardIds: [eomer] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("146003:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: eomer, effectId: "146003:response:1", payments: [{ heroId: eomer, amount: 1 }] }, tab.ctx);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).not.toContain(dear);
      run = sendUnledgered(run, { type: "Choose", optionId: soft }, tab.ctx);
    }
    expect(run.state.cards[eomer]?.resources).toBe(0);
    expect(run.state.cards[soft]?.damage).toBe(printed(tab, EOMER, "attack"));
    expect(run.state.cards[dear]?.damage).toBe(0);
  });

  // Without Captains of the West, committing exhausts him, so no Response either.
  it("146003:A:1 Éomer: no Response with an empty pool, no enemy in the staging area, or once committing exhausted him", () => {
    const tired = table(EFFECTS, { start: "quest", heroes: [{ code: EOMER, seat: 0 }], staging: [SOFT] }, 1);
    expect(triggers(sendUnledgered(begin(tired.state), { type: "Commit", cardIds: [idsOf(tired, EOMER)] }, tired.ctx).state, tired)).not.toContain("146003:response:1");
    const broke = table(EFFECTS, { start: "quest", heroes: [{ code: EOMER, seat: 0 }], staging: [SOFT] }, 0);
    expect(triggers(sendUnledgered(begin(broke.state), { type: "Commit", cardIds: [idsOf(broke, EOMER)] }, broke.ctx).state, broke)).not.toContain("146003:response:1");
    const empty = table(EFFECTS, { start: "quest", heroes: [{ code: EOMER, seat: 0 }], engaged: [{ code: SOFT, seat: 0 }] }, 1);
    expect(triggers(sendUnledgered(begin(empty.state), { type: "Commit", cardIds: [idsOf(empty, EOMER)] }, empty.ctx).state, empty)).not.toContain("146003:response:1");
  });
});

describe("Tom Cotton (146004:A:1, A:2)", () => {
  // "While you are engaged with an enemy with an engagement cost higher than your threat, the first Hobbit ally you play each round does
  // not require a resource match.": Tom (Tactics) alone pays for a Leadership Hobbit ally while the Dear enemy (50) is engaged with
  // you, but not for a second one that round.
  lineSpec("146004:A:1", "Tom Cotton: the first Hobbit ally each round needs no resource match while a dearer enemy is engaged with you", (effects) => {
    const tab = table(effects, { heroes: [{ code: TOM, seat: 0 }], engaged: [{ code: DEAR, seat: 0 }], hand: [{ code: HOBBIT, seat: 0 }, { code: HOBBIT, seat: 0 }] });
    const [first, second] = tab.ids[HOBBIT] ?? [];
    const tom = idsOf(tab, TOM);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: first ?? "", payments: [{ heroId: tom, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[first ?? ""]?.zone).toBe("play");
    expect(refusal(run.state, { type: "PlayCard", cardId: second ?? "", payments: [{ heroId: tom, amount: 1 }] }, tab.ctx)).not.toBeNull();
  });

  it("146004:A:1 Tom Cotton: a Hobbit ally still needs its resource match when the engaged enemy's cost is not above your threat", () => {
    const tab = table(EFFECTS, { heroes: [{ code: TOM, seat: 0 }], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: HOBBIT, seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, HOBBIT), payments: [{ heroId: idsOf(tab, TOM), amount: 1 }] }, tab.ctx)).not.toBeNull();
  });

  // "Response: After a Hobbit ally enters play, it gets +2 Attack until the end of the round.": Rosie Cotton gets it; a plain ally
  // does not offer the Response.
  lineSpec("146004:A:2", "Tom Cotton: after a Hobbit ally enters play, it gets +2 Attack until the end of the round", (effects) => {
    const tab = table(effects, { heroes: [{ code: TOM, seat: 0 }, { code: ARAGORN_CORE, seat: 0 }], hand: [{ code: ROSIE, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [tom, rosie] = [idsOf(tab, TOM), idsOf(tab, ROSIE)];
    let run = play(begin(tab.state), tab, rosie);
    run = sendUnledgered(run, { type: "Trigger", cardId: tom, effectId: "146004:response:1" }, tab.ctx);
    expect(stat(run.state, tab, rosie, "attack")).toBe(printed(tab, ROSIE, "attack") + 2);
    const plain = play(begin(tab.state), tab, idsOf(tab, ALLY));
    expect(triggers(plain.state, tab)).not.toContain("146004:response:1");
    const ended = endRound(run.state, tab);
    expect(stat(ended.state, tab, rosie, "attack")).toBe(printed(tab, ROSIE, "attack"));
  });
});

describe("Rosie Cotton (146005:A:1)", () => {
  // "Action: Exhaust Rosie Cotton to choose a Hobbit hero and an attribute (Willpower, Attack, or Defense). Add Rosie Cotton's Willpower
  // to that hero's chosen attribute until the end of the phase. (Limit once per phase.)": Tom Cotton and Pal (Hobbit heroes) are the
  // choices, not Aragorn; Tom gets +2 Attack (Rosie's Willpower).
  lineSpec("146005:A:1", "Rosie Cotton: exhaust to add her Willpower to a Hobbit hero's chosen attribute, once per phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: TOM, seat: 0 }, { code: PAL, seat: 0 }, { code: ARAGORN_CORE, seat: 0 }], allies: [{ code: ROSIE, seat: 0 }] });
    const [tom, rosie] = [idsOf(tab, TOM), idsOf(tab, ROSIE)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: rosie, effectId: "146005:action:1" }, tab.ctx);
    expect(run.state.cards[rosie]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([tom, idsOf(tab, PAL)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: tom }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["attack", "defense", "willpower"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "attack" }, tab.ctx);
    expect(stat(run.state, tab, tom, "attack")).toBe(printed(tab, TOM, "attack") + printed(tab, ROSIE, "willpower"));
    expect(stat(run.state, tab, tom, "defense")).toBe(printed(tab, TOM, "defense"));
    expect(triggers(updateCard(run.state, rosie, { exhausted: false }), tab)).not.toContain("146005:action:1");
  });
});

describe("Elladan and Elrohir (146007:A:1, 146008:A:1, 146008:A:2)", () => {
  // "While Elrohir is in play, Elladan gets +2 Attack." and "While Elladan is in play, Elrohir gets +2 Defense.": with both in play
  // each gets it, and alone neither does. The other player's Elrohir counts ("in play").
  lineSpec("146007:A:1", "Elladan: +2 Attack while Elrohir is in play", (effects) => {
    const both = table(effects, { seats: 2, heroes: [{ code: TOM, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ELLADAN, seat: 0 }, { code: ELROHIR, seat: 1 }] });
    expect(stat(both.state, both, idsOf(both, ELLADAN), "attack")).toBe(printed(both, ELLADAN, "attack") + 2);
    const alone = table(effects, { heroes: [{ code: TOM, seat: 0 }], allies: [{ code: ELLADAN, seat: 0 }] });
    expect(stat(alone.state, alone, idsOf(alone, ELLADAN), "attack")).toBe(printed(alone, ELLADAN, "attack"));
  });

  lineSpec("146008:A:1", "Elrohir: +2 Defense while Elladan is in play", (effects) => {
    const both = table(effects, { heroes: [{ code: TOM, seat: 0 }], allies: [{ code: ELLADAN, seat: 0 }, { code: ELROHIR, seat: 0 }] });
    expect(stat(both.state, both, idsOf(both, ELROHIR), "defense")).toBe(printed(both, ELROHIR, "defense") + 2);
    expect(stat(both.state, both, idsOf(both, ELLADAN), "defense")).toBe(printed(both, ELLADAN, "defense"));
    const alone = table(effects, { heroes: [{ code: TOM, seat: 0 }], allies: [{ code: ELROHIR, seat: 0 }] });
    expect(stat(alone.state, alone, idsOf(alone, ELROHIR), "defense")).toBe(printed(alone, ELROHIR, "defense"));
  });

  // "Response: After you optionally engage an Orc enemy, ready Elrohir.": the exhausted Elrohir is readied after the player engages the
  // Orc; engaging a plain enemy offers nothing.
  lineSpec("146008:A:2", "Elrohir: after you optionally engage an Orc enemy, ready him", (effects) => {
    const scene = table(effects, { start: "encounter", heroes: [{ code: TOM, seat: 0 }], allies: [{ code: ELROHIR, seat: 0 }], staging: [ORC, MAN] });
    const elrohir = idsOf(scene, ELROHIR);
    const tab = { ...scene, state: updateCard(scene.state, elrohir, { exhausted: true }) };
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, ORC) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("146008:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: elrohir, effectId: "146008:response:1" }, tab.ctx);
    expect(run.state.cards[elrohir]?.exhausted).toBe(false);
    const other = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, MAN) }, tab.ctx);
    expect(triggers(other.state, tab)).not.toContain("146008:response:1");
  });

  // "optionally engage": an Orc that engages through its engagement check (cost 8, threat 8) readies nothing.
  it("146008:A:2 Elrohir: no Response when an Orc engages through an engagement check", () => {
    const scene = table(EFFECTS, { heroes: [{ code: TOM, seat: 0 }], allies: [{ code: ELROHIR, seat: 0 }], staging: [ORC] });
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, ELROHIR), { exhausted: true }) };
    const run = enter(tab.state, tab, "engagement");
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("146008:response:1");
  });
});

describe("Orc Disguise (146009)", () => {
  // "Attach to the Ring-bearer. Limit one per hero.": Frodo (Ring-bearer) is offered, Sam is not; once Frodo wears one, the second
  // copy has no host.
  lineSpec("146009:A:1", "Orc Disguise: Attach to the Ring-bearer, limit one per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }], hand: [{ code: DISGUISE, seat: 0 }, { code: DISGUISE, seat: 0 }] });
    const [first, second] = tab.ids[DISGUISE] ?? [];
    const frodo = idsOf(tab, FRODO);
    expect(hosts(tab, first ?? "")).toEqual([frodo]);
    const run = play(begin(tab.state), tab, first ?? "", frodo);
    expect(run.state.cards[first ?? ""]?.host).toBe(frodo);
    expect([...legalTargets(run.state, { type: "PlayCard", cardId: second ?? "" }, tab.ctx)]).toEqual([]);
  });

  // "While an Orc is making an engagement check with you, it gets +5 engagement cost.": at threat 8 the Orc (engagement cost 8) stays in
  // the staging area and the plain enemy of the same cost engages.
  lineSpec("146009:A:2", "Orc Disguise: an Orc gets +5 engagement cost for its engagement check with you", (effects) => {
    const tab = table(effects, { heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }], attached: [{ code: DISGUISE, host: FRODO }], staging: [ORC] });
    const run = enter(tab.state, tab, "engagement");
    expect(run.state.cards[idsOf(tab, ORC)]?.zone).toBe("staging");
    const plain = table(effects, { heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }], attached: [{ code: DISGUISE, host: FRODO }], staging: [MAN] });
    expect(enter(plain.state, plain, "engagement").state.cards[idsOf(plain, MAN)]?.zone).toBe("engaged");
  });

  // "Response: After an Orc engages you, discard Orc Disguise. Until the end of the round, that enemy cannot attack you.": the Orc the
  // player engages makes no attack in the combat phase; a plain enemy offers no Response.
  lineSpec("146009:A:3", "Orc Disguise: after an Orc engages you, discard it and the Orc cannot attack you this round", (effects) => {
    const tab = table(effects, { start: "encounter", heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }], attached: [{ code: DISGUISE, host: FRODO }], staging: [ORC] });
    const [disguise, orc] = [idsOf(tab, DISGUISE), idsOf(tab, ORC)];
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: orc }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("146009:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: disguise, effectId: "146009:response:1" }, tab.ctx);
    expect(run.state.cards[disguise]?.zone).toBe("discard");
    expect(attacks(run.state, tab)).not.toContain(orc);
    // Declined, the Orc attacks in the combat phase as usual.
    const declined = sendUnledgered(sendUnledgered(begin(tab.state), { type: "Engage", enemyId: orc }, tab.ctx), { type: "Pass" }, tab.ctx);
    expect(attacks(declined.state, tab)).toContain(orc);
    const plain = table(effects, { start: "encounter", heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }], attached: [{ code: DISGUISE, host: FRODO }], staging: [MAN] });
    const other = sendUnledgered(begin(plain.state), { type: "Engage", enemyId: idsOf(plain, MAN) }, plain.ctx);
    expect(triggers(other.state, plain)).not.toContain("146009:response:1");
  });
});

describe("Gúthwinë (146011:A:1)", () => {
  // "Attach to a Rohan hero. Restricted.": Théodred, Éowyn and the other player's Éomer (Rohan heroes) are offered; the Snowbourn Scout
  // (a Rohan ally) and Aragorn are not.
  lineSpec("146011:A:1", "Gúthwinë: Attach to a Rohan hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }, { code: ARAGORN_CORE, seat: 0 }, { code: EOMER, seat: 1 }], allies: [{ code: SCOUT, seat: 0 }], hand: [{ code: GUTHWINE, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, GUTHWINE))).toEqual([THEODRED, EOWYN, EOMER].map((code) => idsOf(tab, code)).sort());
  });
});

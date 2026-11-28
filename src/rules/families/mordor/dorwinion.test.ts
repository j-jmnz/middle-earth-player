// Rules: rr.attachment-cards, rr.shadow-effects, rr.travel, rr.guarded, rr.explored, rr.damage, rr.lasting-effects (data/rules/entries.json); ledger lines 21031:A:2, 21032:A:2, 21032:A:3, 21033:A:2, 21036:A:3, 21039:A:1, 21042:A:2, 21047:A:2, 21047:A:3, 21048:A:2, 21051:A:1, 21078:A:1, 21079:A:1.
// The verbs and hooks the mordor family adds for Danger in Dorwinion, each on a table of the scenario.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../core/state.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { dealShadows } from "../../combat/combat.ts";
import { discardShadows } from "../../combat/shadow.ts";
import { eliminationLevel } from "../../core/eliminate.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { expireModifiers, updateCard, withSeat } from "../../core/state.ts";
import { raiseThreat } from "../../core/threat-dial.ts";
import { holds } from "../../interpret/conditions.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { cardsUnder, moveCard, spawn } from "../../core/zones.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import { printedOf } from "../../core/printed.ts";
import { placeDamage } from "../../core/damage.ts";
import { engageWith } from "../../quest/quest.ts";
import { settle } from "../../engine/machine.ts";
import { allyCard, finish, idOf, opened, resolveRecords, revealedTop, run, statOf, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";

const SECRET = "21039";
const MANOR = "21037";
const table = (layout: Layout = {}) => tableFromLayout("danger-in-dorwinion", { seats: 1, stage: "21077", phase: "Quest", ...layout });
const settled = (made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState): ScenarioState => settle(state, made.ctx, []);

describe("AddRandomSetAsideToStaging: a random set-aside card with the Trait enters the staging area (21078:A:1, 21079:A:1)", () => {
  it("adds one Plot objective, not revealed, and leaves the others set aside; with none set aside nothing is added", () => {
    const made = table({ setAside: ["21033", "21034", "21035", "21030"] });
    const state = run(made, opened(made).state, { verb: "AddRandomSetAsideToStaging", trait: "Plot" });
    const plots = ["21033", "21034", "21035"].filter((code) => where(state, code) === "staging");
    expect(plots).toHaveLength(1);
    expect(state.setAside.map((id) => state.cards[id]?.code).sort()).toEqual(["21030", ...["21033", "21034", "21035"].filter((code) => code !== plots[0])].sort());
    const none = table({ setAside: ["21030"] });
    expect(run(none, opened(none).state, { verb: "AddRandomSetAsideToStaging", trait: "Plot" }).setAside).toHaveLength(1);
  });

  it("adds one Cultist enemy of the three", () => {
    const made = table({ setAside: ["21030", "21031", "21032", "21033"] });
    const state = run(made, opened(made).state, { verb: "AddRandomSetAsideToStaging", trait: "Cultist" });
    expect(["21030", "21031", "21032"].filter((code) => where(state, code) === "staging")).toHaveLength(1);
    expect(where(state, "21033")).toBe("setAside");
  });
});

// A table with a weak ally (attack 1) in play and a strong one (attack 4, the Cultist's target), the Cultist on top of the deck.
function cultistTable(layout: Layout = {}) {
  const made = table({ play: ["ally"], ...layout });
  made.cards.set("strong", allyCard("strong", 3, { attack: 4 }));
  const spawned = spawn(made.state, "strong", { zone: "play", seat: 0 });
  return { made: { ...made, state: spawned.state }, strong: spawned.id };
}

describe("Secret Cultist (21039:A:1): the ally with the highest printed Attack becomes an enemy engaged with its owner", () => {
  it("attaches to the strongest ally, which is an enemy with a blank text box, engaged with its owner", () => {
    const { made, strong } = cultistTable();
    const state = revealedTop(made, SECRET);
    expect(state.cards[strong]).toMatchObject({ code: "strong~enemy", zone: "engaged", controller: 0, owner: 0 });
    expect(state.seats[0]?.engaged).toContain(strong);
    expect(state.cards[idOf(state, SECRET)]).toMatchObject({ zone: "attached", host: strong });
    expect(where(state, "ally")).toBe("play");
    expect(printedOf(made.ctx.cards, "strong~enemy")).toMatchObject({ type: "enemy", attack: 4, health: 2 });
  });

  it("with the Cultist discarded the ally is the owner's card again in the owner's discard pile", () => {
    const { made, strong } = cultistTable();
    const state = revealedTop(made, SECRET);
    const back = run(made, state, { verb: "Discard", target: { kind: "self" } }, { sourceId: idOf(state, SECRET) });
    expect(back.cards[strong]).toMatchObject({ code: "strong", zone: "discard" });
    expect(back.seats[0]?.discard).toContain(strong);
    expect(back.seats[0]?.engaged).not.toContain(strong);
  });

  it("an ally defeated as an enemy goes to its owner's discard pile with its own card", () => {
    const { made, strong } = cultistTable();
    const state = revealedTop(made, SECRET);
    const dead = placeDamage(state, strong, 5, made.ctx.cards, [], "framework", UNATTRIBUTED);
    const done = settled(made, dead);
    expect(done.cards[strong]).toMatchObject({ code: "strong", zone: "discard" });
    expect(done.seats[0]?.discard).toContain(strong);
    expect(where(done, SECRET)).toBe("encounterDiscard");
  });

  it("an owner eliminated: the ally and the Cultist are discarded", () => {
    const { made, strong } = cultistTable();
    const state = revealedTop(made, SECRET);
    const gone = withSeat(state, 0, { ...state.seats[0]!, eliminated: true });
    const done = run(made, gone, { verb: "ReturnConvertedAlly", ifOwnerGone: true }, { sourceId: idOf(state, SECRET) });
    expect(done.cards[strong]).toMatchObject({ code: "strong", zone: "discard" });
    expect(where(done, SECRET)).toBe("encounterDiscard");
  });

  it("with no ally in play it is discarded and nothing becomes an enemy", () => {
    const made = table();
    const state = revealedTop(made, SECRET);
    expect(where(state, SECRET)).not.toBe("attached");
    expect(Object.values(state.cards).filter((card) => card.code.endsWith("~enemy"))).toEqual([]);
  });
});

describe("ResolveActiveTravel: the Travel effect of the active location resolves, unpaid and with no travel (21051:A:1)", () => {
  it("Hillside Manor's Travel discards a random card from each hand and the location stays active", () => {
    const made = table({ active: MANOR, hand: ["01021", "01022"] });
    const state = run(made, opened(made).state, { verb: "ResolveActiveTravel" });
    expect(state.seats[0]?.hand).toHaveLength(1);
    expect(state.seats[0]?.discard).toHaveLength(1);
    expect(state.cards[idOf(state, MANOR)]?.zone).toBe("activeLocation");
  });

  it("does nothing with no active location", () => {
    const made = table({ hand: ["01021"] });
    expect(run(made, opened(made).state, { verb: "ResolveActiveTravel" }).seats[0]?.hand).toHaveLength(1);
  });
});

describe("BarDamageToEngaged: until the end of the round the enemies engaged with the first player cannot take damage (21042:A:2)", () => {
  const damage = (made: { ctx: { cards: Parameters<typeof placeDamage>[3] } }, state: ScenarioState, id: string): number => placeDamage(state, id, 2, made.ctx.cards, [], "framework", UNATTRIBUTED).cards[id]?.damage ?? 0;
  it("an enemy engaged with him takes none, one in the staging area takes it, and one that engages him later takes none", () => {
    const made = table({ engaged: ["21040"], staging: ["21045"] });
    const barred = run(made, opened(made).state, { verb: "BarDamageToEngaged", who: "firstPlayer", until: "endOfRound" });
    const engaged = idOf(barred, "21040");
    const staged = idOf(barred, "21045");
    expect(damage(made, barred, engaged)).toBe(0);
    expect(damage(made, barred, staged)).toBe(2);
    const later = engageWith(barred, 0, staged, []);
    expect(damage(made, later, staged)).toBe(0);
    expect(damage(made, opened(made).state, engaged)).toBe(2);
  });
});

describe("Black Númenórean (21032:A:2, 21032:A:3): the shadow cards with a shadow effect stay faceup and resolve again at each attack", () => {
  const BLACK = "21032";
  const WITH_EFFECT = "21042";
  const WITHOUT_EFFECT = "21043";
  function dealt(made: ReturnType<typeof table>, state: ScenarioState): ScenarioState {
    return settle(dealShadows(state, made.ctx, []), made.ctx, []);
  }

  it("keeps a dealt shadow card that has a shadow effect past the end of the combat phase, and discards one that has none", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: [WITH_EFFECT] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const kept = first.cards[enemy]?.shadowId ?? "";
    expect(first.cards[kept]?.code).toBe(WITH_EFFECT);
    expect(discardShadows(first).cards[kept]?.zone).toBe("shadow");
    const plain = table({ phase: "Combat", engaged: [BLACK], deck: [WITHOUT_EFFECT] });
    const second = dealt(plain, opened(plain).state);
    expect(discardShadows(second).cards[second.cards[idOf(second, BLACK)]?.shadowId ?? ""]?.zone).toBe("encounterDiscard");
  });

  it("deals the next card first, so the attack resolves it and the card held stays beside it; the held card leaves with him", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: [WITH_EFFECT, "21040"] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const old = first.cards[enemy]?.shadowId ?? "";
    const next = dealt(made, updateCard(discardShadows(first), idOf(first, BLACK), {}));
    const card = next.cards[enemy];
    expect(card?.shadowId).not.toBe(old);
    expect(card?.extraShadowIds).toEqual([old]);
    expect(next.cards[card?.shadowId ?? ""]?.code).toBe("21040");
    const gone = moveCard(next, enemy, { zone: "encounterDiscard" });
    expect(gone.cards[old]?.zone).toBe("encounterDiscard");
  });

  it("ResolveHeldShadowEffects resolves the faceup cards' shadow effects against the attack in progress (21042: attacking enemy cannot take damage or raise threat)", () => {
    const made = table({ phase: "Combat", engaged: [BLACK], deck: ["21040"] });
    const first = dealt(made, opened(made).state);
    const enemy = idOf(first, BLACK);
    const held = first.cards[enemy]?.shadowId ?? "";
    const attacking = { ...updateCard(first, held, { face: "up" }), pendingAttack: { enemyId: enemy, seat: 0, defenderId: null, undefended: true } } as unknown as ScenarioState;
    const before = modifiedStat(attacking, attacking.cards[enemy]!, "attack", made.ctx.cards);
    const after = run(made, attacking, { verb: "ResolveHeldShadowEffects" }, { sourceId: enemy });
    expect(modifiedStat(after, after.cards[enemy]!, "attack", made.ctx.cards)).toBe(before + 1);
  });
});

// The progress that explores the active location, and the Forced effects it opens (the stage places its resource too: the first player orders them).
const explore = (made: ReturnType<typeof table>, state: ScenarioState): ScenarioState => finish({ state: run(made, state, { verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }), steps: [] }, made.ctx).state;

describe("Bribes (21033:A:2): the top X cards of each deck are discarded and each event among them puts a resource here", () => {
  it("X is the Threat of the active location when it is explored; the resources are the events discarded, all decks counted", () => {
    const made = table({ staging: ["21033"], active: MANOR, deckOf: ["event", "ally", "event", "event", "event", "event"] });
    const state = opened(made).state;
    const threat = statOf(state, made.ctx.cards, MANOR, "threat");
    const explored = explore(made, state);
    const top = ["event", "ally", "event", "event", "event", "event"].slice(0, threat);
    expect(where(explored, MANOR)).not.toBe("activeLocation");
    expect(explored.seats[0]?.discard).toHaveLength(threat);
    expect(explored.cards[idOf(explored, "21033")]?.resources).toBe(top.filter((code) => code === "event").length);
  });
});

describe("Seedy Tavern (21047:A:2, 21047:A:3): a card lies facedown under it and is revealed when it is explored", () => {
  it("Travel puts the chosen card of the top 5 under it and shuffles the rest back; exploring it reveals the card, not from the encounter deck", () => {
    const made = table({ active: "21047", deck: ["21045", "21041", "21043", "21050", "21044", "21040"] });
    const travel = resolveRecords(opened(made).state, made.ctx, "21047", "travel", idOf(made.state, "21047"));
    const under = cardsUnder(travel.state, idOf(travel.state, "21047"));
    expect(under).toHaveLength(1);
    expect(travel.state.cards[under[0] ?? ""]).toMatchObject({ zone: "under" });
    expect(travel.state.encounterDeck).toHaveLength(5);
    expect(travel.state.encounterDeck).not.toContain(under[0]);
    const explored = explore(made, travel.state);
    expect(cardsUnder(explored, idOf(explored, "21047"))).toEqual([]);
    expect(explored.cards[under[0] ?? ""]?.zone).not.toBe("under");
  });
});

describe("Evidence of the Cult (21036:A:3): free of encounters it goes to the victory display and the main quest gets a resource", () => {
  it("a guarded Evidence stays; once its guard leaves play it is added to the victory display and the quest has 1 resource", () => {
    const made = table({ staging: ["21036"], attached: [{ code: "21045", to: "21036", guard: true }] });
    const state = settle(opened(made).state, made.ctx, []);
    expect(where(state, "21036")).toBe("staging");
    const freed = settle(moveCard(state, idOf(state, "21045"), { zone: "encounterDiscard" }), made.ctx, []);
    expect(where(freed, "21036")).toBe("victory");
    expect(freed.cards[freed.questStage ?? ""]?.resources).toBe(1);
  });
});

describe("raisedThreatThisRound (21048:A:2): a seat that raised its threat this round holds the note until the round ends", () => {
  it("the note is made only while the table holds noteThreatRaised, and the condition reads the acting seat", () => {
    const made = table({ phase: "Combat" });
    const state = opened(made).state;
    const shadow = (from: ScenarioState) => holds(from, { kind: "raisedThreatThisRound" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx);
    expect(shadow(raiseThreat(state, 0, 1, [], UNATTRIBUTED))).toBe(false);
    const noting = run(made, state, { verb: "ModifyStat", stat: "noteThreatRaised", amount: 1, until: "endOfGame", target: "table" }, { sourceId: idOf(state, "21077") });
    expect(shadow(noting)).toBe(false);
    expect(shadow(raiseThreat(noting, 0, 1, [], UNATTRIBUTED))).toBe(true);
    expect(shadow(expireModifiers(raiseThreat(noting, 0, 1, [], UNATTRIBUTED), ["endOfRound"]))).toBe(false);
  });
});

describe("highestPrintedAttack (21039:A:1): of the allies in play only those with the highest printed Attack, whatever they have now", () => {
  it("a weak ally with a bonus is not chosen over a strong one; allies tied are all candidates", () => {
    const { made, strong } = cultistTable();
    const weak = idOf(made.state, "ally");
    const state = { ...opened(made).state, modifiers: [{ instanceId: weak, sourceId: weak, stat: "attack" as const, amount: 5, until: "endOfPhase" as const }] };
    const candidates = (from: ScenarioState): string[] => pickCandidates(from, { type: "ally", control: "any", highestPrintedAttack: true }, 0, [], null, made.ctx);
    expect(candidates(state)).toEqual([strong]);
    const tied = spawn(state, "strong", { zone: "play", seat: 0 });
    expect(candidates(tied.state).sort()).toEqual([strong, tied.id].sort());
  });
});

describe("the Plot objectives and the stage 3 cap read from the table", () => {
  it("Sauron Worship enters play with 1 damage token and lowers each player's elimination level by 1 for each (21035:A:1, A:2)", () => {
    const made = table({ setAside: ["21035"] });
    const state = run(made, opened(made).state, { verb: "AddRandomSetAsideToStaging", trait: "Plot" });
    const worship = idOf(state, "21035");
    expect(state.cards[worship]?.damage).toBe(1);
    expect(eliminationLevel(syncConstants(state, made.ctx), 0)).toBe(49);
    expect(eliminationLevel(syncConstants(updateCard(state, worship, { damage: 3 }), made.ctx), 0)).toBe(47);
  });

  it("Leader of the Cult: a Cultist takes at most the printed quest points of the active location a round, none with no active location (21079:B:1)", () => {
    const made = table({ stage: "21079", staging: ["21030"], active: MANOR });
    const state = opened(made).state;
    const cultist = idOf(state, "21030");
    const points = printedOf(made.ctx.cards, MANOR).questPoints ?? 0;
    const damageOf = (from: ScenarioState): number => placeDamage(from, cultist, 99, made.ctx.cards, [], "framework", UNATTRIBUTED).cards[cultist]?.damage ?? 0;
    expect(points).toBeGreaterThan(0);
    expect(damageOf(state)).toBe(points);
    const bare = table({ stage: "21079", staging: ["21030"] });
    expect(placeDamage(opened(bare).state, idOf(bare.state, "21030"), 3, bare.ctx.cards, [], "framework", UNATTRIBUTED).cards[idOf(bare.state, "21030")]?.damage).toBe(0);
  });
});

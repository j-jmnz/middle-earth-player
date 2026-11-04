// Rules: rr.step-3-3, rr.engaged, rr.shadow-effects, rr.search, rr.cancel, rr.doomed-x, rr.attachment-cards (data/rules/entries.json). The Oath's encounter
// enemies and treacheries: each line of the ledger (data/printed/mirkwood-paths.json) has a record, and these tests run them on a table of plain-number
// heroes (test/scenarios/the-oath/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { codesIn, engageStaged, fight, loadOathWorld, oathTable, resolveReveal, settleChoices, type OathLayout, type OathWorld } from "../../../../test/scenarios/the-oath/scene.ts";
import { reveal } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first, type Run, send, start } from "../../../../test/harness/scene-kit.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

function make(layout: OathLayout = {}) {
  const made = oathTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

function revealed(code: string, layout: OathLayout = {}, pick?: (state: ScenarioState) => string) {
  const made = make(layout);
  return { ...made, run: resolveReveal(made.state, made.ctx, code, pick) };
}

const heroes = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone === "heroes");
const damageOn = (state: ScenarioState) => heroes(state).reduce((sum, card) => sum + card.damage, 0);
const exhausted = (state: ScenarioState) => heroes(state).filter((card) => card.exhausted);
const attack = (state: ScenarioState, id: string, cards: OathWorld["cards"]) => modifiedStat(state, state.cards[id]!, "attack", cards);

describe("Spiders of Mirkwood (41008)", () => {
  it("gets +1 Attack for each exhausted character of the player it is engaged with (41008:A:1)", () => {
    const calm = make({ engaged: [{ code: "41008", seat: 0 }] });
    const spider = first(calm.state, "41008");
    const base = attack(calm.state, spider, world.cards);
    const tired = make({ engaged: [{ code: "41008", seat: 0 }] });
    const spent = { ...tired.state, cards: { ...tired.state.cards, [tired.hero]: { ...tired.state.cards[tired.hero]!, exhausted: true }, [tired.hero2]: { ...tired.state.cards[tired.hero2]!, exhausted: true } } };
    const synced = syncConstants(spent, tired.ctx);
    expect(attack(synced, first(synced, "41008"), world.cards)).toBe(base + 2);
    // In the staging area it is engaged with nobody.
    const staged = make({ staging: ["41008"] });
    const loose = { ...staged.state, cards: { ...staged.state.cards, [staged.hero]: { ...staged.state.cards[staged.hero]!, exhausted: true } } };
    expect(attack(syncConstants(loose, staged.ctx), first(loose, "41008"), world.cards)).toBe(base);
  });

  it("exhausts a character as a Shadow card, and deals that character 2 damage when the attack is undefended (41008:A:2)", () => {
    const defended = fight(world, "41008", "grunt");
    // The defender exhausted to defend, the Shadow exhausts the other hero: both are exhausted at once before the phase's refresh readies them.
    expect(defended.seen.some((state) => exhausted(state).length === 2)).toBe(true);
    const undefended = fight(world, "41008", "grunt", {}, { undefended: true });
    // The ready hero is exhausted first; its 2 damage and the attack's own 1 are the damage the heroes took.
    expect(damageOn(undefended.run.state)).toBe(3);
    expect(undefended.seen.some((state) => state.cards[undefended.hero]?.exhausted && state.cards[undefended.hero]?.damage === 3)).toBe(true);
    expect(causeProblems(undefended.run.steps)).toEqual([]);
  });
});

describe("Great Spider (41009)", () => {
  it("has the player it engages exhaust a character (41009:A:1)", () => {
    const made = make({ staging: ["41009"], phase: "Encounter" });
    const run = engageStaged(made.state, made.ctx, "41009");
    expect(exhausted(run.state)).toHaveLength(1);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("deals 1 damage to an exhausted character as a Shadow card (41009:A:2)", () => {
    // The defender exhausts to defend, so the attack's damage and the Shadow's meet on it.
    const hit = fight(world, "41009", "grunt");
    // The attack (Attack 1 against Defense 2) deals nothing: the 1 damage is the Shadow's, on the exhausted defender.
    expect(hit.run.state.cards[hit.hero]?.damage).toBe(1);
    expect(hit.run.state.cards[hit.hero2]?.damage).toBe(0);
  });
});

describe("Goblin Troop (41019)", () => {
  it("cannot have attachments (41019:A:1)", () => {
    const made = make({ engaged: [{ code: "41019", seat: 0 }] });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotHaveAttachments" && modifier.instanceId === first(made.state, "41019"))).toBe(true);
  });

  it("gives each other Goblin enemy engaged with the same player +1 Attack and +1 Defense while it is engaged (41019:A:2)", () => {
    const made = make({ seats: 2, engaged: [{ code: "41019", seat: 0 }, { code: "41020", seat: 0 }, { code: "41020", seat: 1 }] });
    const [mine, theirs] = made.state.cards ? Object.values(made.state.cards).filter((card) => card.code === "41020") : [];
    const plain = make({ seats: 2, engaged: [{ code: "41020", seat: 0 }, { code: "41020", seat: 1 }] });
    const [plainMine, plainTheirs] = Object.values(plain.state.cards).filter((card) => card.code === "41020");
    const stat = (state: ScenarioState, id: string | undefined, which: "attack" | "defense") => modifiedStat(state, state.cards[id ?? ""]!, which, world.cards);
    expect(stat(made.state, mine?.id, "attack")).toBe(stat(plain.state, plainMine?.id, "attack") + 1);
    expect(stat(made.state, mine?.id, "defense")).toBe(stat(plain.state, plainMine?.id, "defense") + 1);
    // The Goblin engaged with the other player, and Goblin Troop itself, get nothing.
    expect(stat(made.state, theirs?.id, "attack")).toBe(stat(plain.state, plainTheirs?.id, "attack"));
    const troop = first(made.state, "41019");
    expect(stat(made.state, troop, "attack")).toBe(world.cards.get("41019")?.attack);
    // In the staging area it gives nothing.
    const staged = make({ staging: ["41019"], engaged: [{ code: "41020", seat: 0 }] });
    const alone = Object.values(staged.state.cards).find((card) => card.code === "41020");
    expect(stat(staged.state, alone?.id, "attack")).toBe(world.cards.get("41020")?.attack);
  });

  it("adds 2 Attack to the attacking enemy as a Shadow card (41019:A:3)", () => {
    const hit = fight(world, "41019", "grunt");
    // Attack 1 + 2 against Defense 2 leaves 1 damage on the defender.
    expect(hit.run.state.cards[hit.hero]?.damage).toBe(1);
    expect(fight(world, "f0", "grunt").run.state.cards[hit.hero]?.damage).toBe(0);
  });
});

describe("Goblin Sniper (41020)", () => {
  it("cannot be optionally engaged in the encounter phase while another enemy is in the staging area (41020:A:1)", () => {
    const alone = make({ staging: ["41020"], phase: "Encounter" });
    expect(legalTargets(alone.state, { type: "Engage" }, alone.ctx)).toEqual([first(alone.state, "41020")]);
    const crowded = make({ staging: ["41020", "f3"], phase: "Encounter" });
    expect(legalTargets(crowded.state, { type: "Engage" }, crowded.ctx)).toEqual([first(crowded.state, "f3")]);
  });

  it("deals each player 1 damage on a character he controls at the end of the combat phase while it is in the staging area (41020:A:2)", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, staging: ["41020"], phase: "Encounter" });
      let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
      for (let guard = 0; guard < 80 && run.state.phase !== "End of round" && !run.state.lost; guard += 1) {
        const window = run.state.window;
        if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
        else {
          const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack" || item.type === "DeclineEngage");
          if (!intent) break;
          run = send(run, intent as PlayerIntent, made.ctx);
        }
      }
      expect(damageOn(run.state), `${seats} seats`).toBe(seats);
      expect(causeProblems(run.steps)).toEqual([]);
    }
  });

  it("deals nothing at the end of the combat phase when it is engaged (41020:A:2)", () => {
    const made = make({ engaged: [{ code: "41020", seat: 0 }], phase: "Combat" });
    let run: Run = start(made.state);
    for (let guard = 0; guard < 40 && run.state.phase !== "Refresh" && !run.state.lost; guard += 1) {
      if (run.state.window?.kind === "defense") run = send(run, { type: "DeclareDefender", defenderId: made.hero }, made.ctx);
      else {
        const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
        if (!intent) break;
        run = send(run, intent as PlayerIntent, made.ctx);
      }
    }
    expect(damageOn(run.state)).toBe(0);
  });
});

describe("Goblins are Upon You! (41024:A:1)", () => {
  it("has each player's Goblin enemy enter engaged with him, and no Response can cancel it", () => {
    const made = make({ seats: 2, deck: ["41024", "gob", "gob", "f0"], hand: ["cancel"] });
    const revealing = reveal(made.state, made.ctx, 2);
    const cancel = first(revealing.state, "cancel");
    expect(legalIntents(revealing.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === cancel)).toBe(false);
    const done = settleChoices(revealing, made.ctx);
    const engagedBy = (seat: number) => (done.state.seats[seat]?.engaged ?? []).map((id) => done.state.cards[id]?.code);
    expect(engagedBy(0)).toEqual(["gob"]);
    expect(engagedBy(1)).toEqual(["gob"]);
    expect(causeProblems(done.steps)).toEqual([]);
  });

  it("is an ordinary effect when revealed apart from the table: the same hand offers its cancel to another treachery", () => {
    const made = make({ seats: 1, deck: ["41026", "f0"], hand: ["cancel"] });
    const revealing = reveal(made.state, made.ctx, 1);
    const cancel = first(revealing.state, "cancel");
    expect(legalIntents(revealing.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === cancel)).toBe(true);
  });
});

describe("Goblin Runners (41021)", () => {
  it("makes the attacking enemy attack again once this attack is over, with a new shadow card, as a Shadow card (41021:A:2)", () => {
    const once = fight(world, "f0", "grunt");
    const twice = fight(world, "41021", "grunt");
    // Two attacks of Attack 1 against Defense 2 deal no damage; count the attacks from the steps instead.
    const attacks = (steps: readonly { kind: string }[]) => steps.filter((step) => step.kind === "attack").length;
    expect(attacks(once.run.steps)).toBe(1);
    expect(attacks(twice.run.steps)).toBe(2);
    expect(causeProblems(twice.run.steps)).toEqual([]);
  });
});

describe("Goblintown Scavengers (41022)", () => {
  it("discards the top card of each player's deck and takes the total printed cost as Threat until the end of the phase (41022:A:1)", () => {
    const made = revealed("41022", { seats: 2, deckOf: ["ally", "blade", "filler"] });
    const threat = modifiedStat(made.run.state, made.run.state.cards[made.run.id]!, "threat", world.cards);
    // Each player's top card (ally, cost 0) is discarded: nothing added, one card gone from each deck.
    expect(made.run.state.seats[0].deck).toHaveLength(2);
    expect(made.run.state.seats[1].deck).toHaveLength(2);
    expect(threat).toBe(world.cards.get("41022")?.threat);
  });

  it("adds the printed costs of the discarded cards, and nothing for a player with no deck (41022:A:1)", () => {
    world.cards.set("pricey", { ...world.cards.get("ally")!, code: "pricey", name: "pricey", cost: 3 });
    const made = revealed("41022", { seats: 2, deckOf: ["pricey", "filler"] });
    expect(modifiedStat(made.run.state, made.run.state.cards[made.run.id]!, "threat", world.cards)).toBe((world.cards.get("41022")?.threat ?? 0) + 6);
    const empty = revealed("41022", { seats: 2 });
    expect(modifiedStat(empty.run.state, empty.run.state.cards[empty.run.id]!, "threat", world.cards)).toBe(world.cards.get("41022")?.threat);
  });
});

describe("Wild Wargs (41023)", () => {
  it("discards the top card of the encounter deck after it engages a player, and puts a Goblin enemy discarded into play engaged with him (41023:A:1)", () => {
    const goblin = make({ staging: ["41023"], phase: "Encounter", deck: ["41020", "f0"] });
    const run = engageStaged(goblin.state, goblin.ctx, "41023");
    expect(codesIn(run.state, "engaged")).toEqual(["41020", "41023"]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
    const other = make({ staging: ["41023"], phase: "Encounter", deck: ["f0", "41020"] });
    const plain = engageStaged(other.state, other.ctx, "41023");
    expect(codesIn(plain.state, "engaged")).toEqual(["41023"]);
    expect(codesIn(plain.state, "encounterDiscard")).toEqual(["f0"]);
  });
});

describe("Stalking Goblin and the other Shadow-only effects", () => {
  it("Goblins are Upon You! adds 1 Attack for each Goblin enemy engaged with the defending player (41024:A:2)", () => {
    const none = fight(world, "41024", "grunt");
    expect(none.run.state.cards[none.hero]?.damage).toBe(0);
    const goblins = fight(world, "41024", "grunt", { engaged: [{ code: "gob", seat: 0 }, { code: "gob", seat: 0 }] });
    // Attack 1 + 2 Goblins = 3 against Defense 2: 1 damage.
    expect(goblins.run.state.cards[goblins.hero]?.damage).toBe(1);
  });

  it("Eyes in the Dark discards an ally when the attack is undefended, and not otherwise (41025:A:3)", () => {
    expect(codesIn(fight(world, "41025", "grunt", { allies: ["ally"] }, { undefended: true }).run.state, "discard")).toContain("ally");
    expect(codesIn(fight(world, "41025", "grunt", { allies: ["ally"] }).run.state, "play")).toContain("ally");
  });

  it("Obsidian Arrows deals 1 damage to a character of the defending player as a Shadow card (41026:A:2)", () => {
    const hit = fight(world, "41026", "grunt");
    expect(damageOn(hit.run.state)).toBe(1);
  });

  it("Driven by Shadow discards 1 attachment from the defending character, or all of the defending player's when undefended (41016:A:2)", () => {
    const one = fight(world, "41016", "grunt", { attachments: ["blade", "blade"] });
    expect(codesIn(one.run.state, "discard")).toEqual(["blade"]);
    const all = fight(world, "41016", "grunt", { attachments: ["blade", "blade"] }, { undefended: true });
    expect(codesIn(all.run.state, "discard")).toEqual(["blade", "blade"]);
  });

  it("Surprising Speed adds 1 Attack and returns the attacker to the staging area after the attack (41017:A:2)", () => {
    const hit = fight(world, "41017", "grunt");
    expect(hit.run.state.cards[first(hit.run.state, "grunt")]?.zone).toBe("staging");
    expect(hit.run.state.cards[hit.hero]?.damage).toBe(0);
    expect(fight(world, "f0", "grunt").run.state.cards[first(hit.run.state, "grunt")]?.zone).toBe("engaged");
  });
});

describe("treacheries when revealed", () => {
  it("Driven by Shadow gives the enemies and locations in the staging area +1 Threat for the phase and gains surge with none there (41016:A:1)", () => {
    const busy = revealed("41016", { staging: ["f3", "place"] });
    expect(modifiedStat(busy.run.state, busy.run.state.cards[first(busy.run.state, "f3")]!, "threat", world.cards)).toBe(4);
    expect(modifiedStat(busy.run.state, busy.run.state.cards[first(busy.run.state, "place")]!, "threat", world.cards)).toBe(3);
    const empty = revealed("41016");
    expect(empty.run.state.cards[empty.run.id]).toBeDefined();
  });

  it("Surprising Speed has each player return an engaged enemy to the staging area, and gains surge and doomed 1 when none is returned (41017:A:1)", () => {
    const returned = revealed("41017", { seats: 2, engaged: [{ code: "f0", seat: 0 }, { code: "grunt", seat: 1 }] });
    expect(codesIn(returned.run.state, "engaged")).toEqual([]);
    expect(codesIn(returned.run.state, "staging").filter((code) => code !== "41017")).toEqual(["f0", "grunt"]);
    expect(returned.run.state.seats[0].threat).toBe(28);
    const none = revealed("41017", { seats: 2 });
    expect(none.run.state.seats[0].threat).toBe(29);
    expect(none.run.state.seats[1].threat).toBe(27);
    expect(causeProblems(none.run.steps)).toEqual([]);
  });

  it("Eyes in the Dark has each player raise their threat for each questing character, or discard one (41025:A:2)", () => {
    const made = make({ seats: 2 });
    const mine = first(made.state, "dh1");
    const committed = { ...made.state, cards: { ...made.state.cards, [mine]: { ...made.state.cards[mine]!, committed: true }, [made.seat1Hero ?? ""]: { ...made.state.cards[made.seat1Hero ?? ""]!, committed: true } } };
    // The first option of each player's choice is the threat.
    const threat = resolveReveal(committed, made.ctx, "41025");
    expect(threat.state.seats[0].threat).toBe(29);
    expect(threat.state.seats[1].threat).toBe(27);
    // Choosing the discard has each player discard a questing character.
    const discard = resolveReveal(committed, made.ctx, "41025", (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === "discard") ?? state.window.options[0] ?? "") : ""));
    expect(codesIn(discard.state, "heroes")).toHaveLength(1);
  });

  it("Obsidian Arrows deals 2 damage to a character the revealing player controls (41026:A:1)", () => {
    const hit = revealed("41026");
    expect(damageOn(hit.run.state)).toBe(2);
  });

  it("Caught in a Web attaches to a hero of the player with the highest threat; that hero does not ready unless the pool pays 2 (41018:A:1)", () => {
    const made = revealed("41018", { seats: 2, threat: [25, 31] });
    const web = first(made.run.state, "41018");
    expect(made.run.state.cards[web]?.zone).toBe("attached");
    expect(made.run.state.cards[made.run.state.cards[web]?.host ?? ""]?.controller).toBe(1);
    expect(made.run.state.modifiers.some((modifier) => modifier.stat === "doesNotReady" && modifier.sourceId === web)).toBe(true);
  });
});

// Rules: rr.ownership-and-control, rr.first-player, rr.resource-phase, rr.step-1-2, rr.response, rr.action, rr.forced, rr.search, rr.attachment-cards,
// rr.step-3-2, rr.step-6-4-2, rr.refresh-phase (data/rules/entries.json).
// The Over Hill and Under Hill heroes, allies and attachments, written from their card text (data/cards; data/printed holds no ledger for this box yet): Bilbo Baggins 131001:A:1 and A:2,
// Thorin Oakenshield 131002:A:1, Nori 131003:A:1, Ori 131004:A:1, Beorn 131005:A:1 and A:3, Fili 131006:A:1, Kili 131007:A:1, Bofur 131008:A:1,
// Gandalf 131010:A:1 and A:2, Cram 131011:A:1, Spare Hood and Cloak 131012:A:1, Thrór's Map 131013:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents, reduce, type PlayerIntent, type ReduceContext } from "../../rules/engine/reduce.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { withMode, type ScenarioState } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { fund, payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { causeProblems } from "../../../test/harness/cause-check.ts";
import { begin, buildTable, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";

const BILBO = "131001";
const THORIN = "131002";
const NORI = "131003";
const ORI = "131004";
const BEORN = "131005";
const FILI = "131006";
const KILI = "131007";
const BOFUR = "131008";
const GANDALF = "131010";
const CRAM = "131011";
const HOOD = "131012";
const MAP = "131013";
// Steward of Gondor: "Action: Exhaust Steward of Gondor to add 2 resources to attached hero's resource pool."
const STEWARD = "01026";
// Dwarven Axe: a Weapon attachment.
const AXE = "01041";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([BILBO, THORIN, NORI, ORI, BEORN, FILI, KILI, BOFUR, GANDALF, CRAM, HOOD, MAP, STEWARD, AXE]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// The harness's send (test/harness/scene.ts), save one cause problem it tolerates: data/printed has no ledger for this box yet, so a step these
// cards' records cause names a line "which is not in the ledger". Every other cause problem still fails the intent.
function send(run: Run, intent: PlayerIntent, ctx: ReduceContext): Run {
  const result = expectOk(reduce(run.state, intent, ctx));
  const problems = causeProblems(result.steps).filter((problem) => !/names line 131\d{3}:A:\d+, which is not in the ledger/.test(problem));
  if (problems.length > 0) throw new Error(`Steps without a verified cause after ${intent.type}: ${problems.join("; ")}`);
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

// The harness's passWindows on this file's send: the framework action windows are passed until the game asks for something else.
function passWindows(run: Run, ctx: ReduceContext): Run {
  let next = run;
  for (let guard = 0; guard < 20 && next.state.window?.kind === "frameAction"; guard += 1) next = send(next, { type: "Pass" }, ctx);
  return next;
}

// A table on these records, every hero of every seat holding `resources`, the constants brought up to date.
function table(effects: readonly Effect[], scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene, effects });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

function triggers(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

function choices(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

function play(tab: Table, code: string, run: Run = begin(tab.state)): Run {
  const card = tab.ids[code]?.find((id) => run.state.cards[id]?.zone === "hand") ?? idsOf(tab, code);
  return send(run, { type: "PlayCard", cardId: card, payments: payFor(run.state, tab.ctx, card) }, tab.ctx);
}

// The reason the attachment cannot be played on the host, or null when it can.
function onto(tab: Table, code: string, hostId: string): string | null {
  const card = idsOf(tab, code);
  return refusal(tab.state, { type: "PlayCard", cardId: card, hostId, payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
}

// The engine moves on to `mode` (its phase begins) and runs to its next window.
function enter(state: ScenarioState, tab: Table, mode: Parameters<typeof withMode>[1]): Run {
  return begin(settle({ ...withMode(state, mode), window: null }, tab.ctx, []));
}

// A deck of `count` filler cards for the first seat.
const fillers = (count: number) => Array.from({ length: count }, () => ({ code: "card", seat: 0 }));

describe("Bilbo Baggins (131001:A:1, A:2)", () => {
  // "The first player gains control of Bilbo Baggins."
  lineSpec("131001:A:1", "the first player takes control of him, and he follows the first player token", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THORIN, seat: 0 }, { code: BILBO, seat: 1 }, { code: NORI, seat: 1 }] });
    const bilbo = idsOf(tab, BILBO);
    let run = send(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[bilbo]?.controller).toBe(0);
    expect(run.state.seats[0]?.heroes).toContain(bilbo);
    run = send(begin({ ...run.state, firstPlayer: 1 }), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[bilbo]?.controller).toBe(1);
  });

  // "Bilbo Baggins cannot gain resources from player card effects."
  lineSpec("131001:A:2", "gains no resource from a player card effect", (effects) => {
    const tab = table(effects, { heroes: [{ code: BILBO, seat: 0 }, { code: THORIN, seat: 0 }], attached: [{ code: STEWARD, host: BILBO }] }, 0);
    const run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STEWARD), effectId: "01026:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, STEWARD)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, BILBO)]?.resources).toBe(0);
  });

  it("131001:A:2 still collects his resource in the resource phase (a framework step, not a player card effect)", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BILBO, seat: 0 }, { code: THORIN, seat: 0 }], playerDeck: fillers(3) }, 0);
    const run = enter(tab.state, tab, "beginRound");
    expect(run.state.cards[idsOf(tab, BILBO)]?.resources).toBe(1);
  });
});

describe("Thorin Oakenshield (131002:A:1) and Ori (131004:A:1)", () => {
  // Thorin, Nori and Ori, and Fili and Kili when `allies` is 2: five Dwarf characters.
  function dwarves(effects: readonly Effect[], allies: number): Table {
    const all = [FILI, KILI].slice(0, allies).map((code) => ({ code, seat: 0 }));
    return table(effects, { heroes: [{ code: THORIN, seat: 0 }, { code: NORI, seat: 0 }, { code: ORI, seat: 0 }], allies: all, playerDeck: fillers(6) }, 0);
  }

  // "If you control at least 5 Dwarf characters, add 1 additional resource to Thorin Oakenshield's pool when you collect resources during the resource phase."
  lineSpec("131002:A:1", "collects 1 more resource with 5 Dwarf characters, the usual 1 with 4", (effects) => {
    const five = dwarves(effects, 2);
    const run = enter(five.state, five, "beginRound");
    expect(run.state.cards[idsOf(five, THORIN)]?.resources).toBe(2);
    expect(run.state.cards[idsOf(five, NORI)]?.resources).toBe(1);
    const four = dwarves(effects, 1);
    expect(enter(four.state, four, "beginRound").state.cards[idsOf(four, THORIN)]?.resources).toBe(1);
  });

  // "If you control at least 5 Dwarf characters, draw 1 additional card at the beginning of the resource phase."
  lineSpec("131004:A:1", "draws 1 more card in the resource phase with 5 Dwarf characters, the usual 1 with 4", (effects) => {
    const five = dwarves(effects, 2);
    expect(enter(five.state, five, "beginRound").state.seats[0]?.hand).toHaveLength(2);
    const four = dwarves(effects, 1);
    expect(enter(four.state, four, "beginRound").state.seats[0]?.hand).toHaveLength(1);
  });
});

describe("Nori (131003:A:1)", () => {
  // "Response: After you play a Dwarf character from your hand, reduce your threat by 1."
  lineSpec("131003:A:1", "lowers your threat by 1 after you play a Dwarf ally from your hand", (effects) => {
    const tab = table(effects, { heroes: [{ code: NORI, seat: 0 }, { code: ORI, seat: 0 }], hand: [{ code: KILI, seat: 0 }] });
    const threat = tab.state.seats[0]?.threat ?? 0;
    let run = play(tab, KILI);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, NORI), effectId: "131003:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(threat - 1);
  });

  it("131003:A:1 is not offered after an ally that is not a Dwarf, or a Dwarf put into play from the deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: NORI, seat: 0 }, { code: THORIN, seat: 0 }], hand: [{ code: "ally", seat: 0 }, { code: FILI, seat: 0 }], playerDeck: [{ code: KILI, seat: 0 }] });
    const plain = play(tab, "ally");
    expect(triggers(plain.state, tab)).not.toContain("131003:response:1");
    // Fili is played from the hand: Nori answers it. Fili's Response then puts Kili into play from the deck, which is not playing him from the hand.
    const threat = plain.state.seats[0]?.threat ?? 0;
    let run = play(tab, FILI, plain);
    expect(triggers(run.state, tab).sort()).toEqual(["131003:response:1", "131006:response:1"]);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, NORI), effectId: "131003:response:1" }, tab.ctx);
    run = send(run, { type: "Trigger", cardId: idsOf(tab, FILI), effectId: "131006:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, KILI)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("131003:response:1");
    expect(run.state.seats[0]?.threat).toBe(threat - 1);
  });
});

describe("Beorn (131005:A:1, A:3)", () => {
  // "Sentinel. Cannot have attachments." (the keyword is the card's own)
  lineSpec("131005:A:1", "cannot have an attachment that another hero can", (effects) => {
    const tab = table(effects, { heroes: [{ code: BEORN, seat: 0 }, { code: THORIN, seat: 0 }], hand: [{ code: STEWARD, seat: 0 }] });
    expect(onto(tab, STEWARD, idsOf(tab, BEORN))).not.toBeNull();
    expect(onto(tab, STEWARD, idsOf(tab, THORIN))).toBeNull();
  });

  // "Beorn does not exhaust to defend."
  lineSpec("131005:A:3", "stays ready after he is declared as a defender", (effects) => {
    // Fili can still attack afterwards, so the combat phase stops at the player attacks and the refresh phase does not ready Beorn.
    const tab = table(effects, { heroes: [{ code: BEORN, seat: 0 }], allies: [{ code: FILI, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    const beorn = idsOf(tab, BEORN);
    let run = passWindows(enter(tab.state, tab, "combatStart"), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = send(run, { type: "DeclareDefender", defenderId: beorn }, tab.ctx);
    expect(run.state.cards[beorn]?.exhausted).toBe(false);
  });
});

describe("Fili and Kili (131006:A:1, 131007:A:1)", () => {
  // "Response: After you play Fili from your hand during the planning phase, search your deck for Kili and put him into play under your control. Then, shuffle your deck."
  // Kili's line is the same with the names swapped.
  for (const [code, other, line, effect] of [[FILI, KILI, "131006:A:1", "131006:response:1"], [KILI, FILI, "131007:A:1", "131007:response:1"]] as const) {
    lineSpec(line, `after it is played in the planning phase, puts the other brother from the deck into play`, (effects) => {
      const deck = [{ code: "card", seat: 0 }, { code: other, seat: 0 }, ...fillers(4)];
      const tab = table(effects, { heroes: [{ code: THORIN, seat: 0 }, { code: NORI, seat: 0 }], hand: [{ code, seat: 0 }], playerDeck: deck });
      const brother = idsOf(tab, other);
      const cursor = tab.state.seedCursor;
      let run = play(tab, code);
      run = send(run, { type: "Trigger", cardId: idsOf(tab, code), effectId: effect }, tab.ctx);
      if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: brother }, tab.ctx);
      expect(run.state.cards[brother]).toMatchObject({ zone: "play", controller: 0 });
      expect(run.state.seats[0]?.deck).toHaveLength(5);
      // "Then, shuffle your deck": the shuffle draws on the seed.
      expect(run.state.seedCursor).toBeGreaterThan(cursor);
    });
  }
});

describe("Bofur (131008:A:1)", () => {
  // "Action: Exhaust Bofur to search the top 5 cards of your deck for 1 Weapon attachment. Add that card to your hand and shuffle the other cards back into your deck."
  lineSpec("131008:A:1", "exhausts to take 1 Weapon attachment from the top 5 cards into the hand", (effects) => {
    // Top 5: a card, Steward of Gondor (not a Weapon), a card, Dwarven Axe, a card; a second Axe lies sixth.
    const deck = [{ code: "card", seat: 0 }, { code: STEWARD, seat: 0 }, { code: "card", seat: 0 }, { code: AXE, seat: 0 }, { code: "card", seat: 0 }, { code: AXE, seat: 0 }];
    const tab = table(effects, { heroes: [{ code: THORIN, seat: 0 }], allies: [{ code: BOFUR, seat: 0 }], playerDeck: deck });
    const [axe, deeper] = tab.ids[AXE] ?? [];
    let run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, BOFUR), effectId: "131008:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BOFUR)]?.exhausted).toBe(true);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).not.toContain(idsOf(tab, STEWARD));
      expect(choices(run.state, tab)).not.toContain(deeper);
      run = send(run, { type: "Choose", optionId: axe ?? "" }, tab.ctx);
    }
    expect(run.state.seats[0]?.hand).toEqual([axe]);
    expect(run.state.seats[0]?.deck).toHaveLength(5);
  });
});

describe("Gandalf (131010:A:1, A:2)", () => {
  // "Gandalf does not exhaust to commit to a quest."
  lineSpec("131010:A:1", "is committed to the quest and stays ready", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: THORIN, seat: 0 }], allies: [{ code: GANDALF, seat: 0 }], deck: ["f0", "f0"] });
    const gandalf = idsOf(tab, GANDALF);
    const run = send(begin(tab.state), { type: "Commit", cardIds: [gandalf, idsOf(tab, THORIN)] }, tab.ctx);
    expect(run.state.cards[gandalf]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[idsOf(tab, THORIN)]?.exhausted).toBe(true);
  });

  // "Forced: At the end of the refresh phase, discard Gandalf from play. You may raise your threat by 2 to cancel this effect."
  function refreshEnds(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: THORIN, seat: 0 }], allies: [{ code: GANDALF, seat: 0 }] });
    return { tab, run: enter(tab.state, tab, "refresh") };
  }

  lineSpec("131010:A:2", "is discarded at the end of the refresh phase", (effects) => {
    const { tab, run: ended } = refreshEnds(effects);
    let run = ended;
    if (choices(run.state, tab).includes("discard")) run = send(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GANDALF)]?.zone).toBe("discard");
    // The refresh phase raised the threat by its own 1 only.
    expect(run.state.seats[0]?.threat).toBe(9);
  });

  lineSpec("131010:A:2", "stays in play when the player raises their threat by 2", (effects) => {
    const { tab, run: ended } = refreshEnds(effects);
    expect(choices(ended.state, tab).sort()).toEqual(["cancel", "discard"]);
    const run = send(ended, { type: "Choose", optionId: "cancel" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GANDALF)]?.zone).toBe("play");
    // 8, +1 for the refresh phase, +2 to keep him.
    expect(run.state.seats[0]?.threat).toBe(11);
  });

  it("131010:A:2 does not fire at the end of another phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THORIN, seat: 0 }], allies: [{ code: GANDALF, seat: 0 }] });
    const run = enter(tab.state, tab, "questCommit");
    expect(run.state.cards[idsOf(tab, GANDALF)]?.zone).toBe("play");
    expect(choices(run.state, tab)).not.toContain("discard");
  });
});

describe("Spare Hood and Cloak (131012:A:2)", () => {
  // "Action: Exhaust Spare Hood and Cloak and exhaust attached character to ready another character. Then, attach Spare Hood and Cloak to that character."
  // rr.then: the text after "Then" resolves only if the text before it resolved in full. Readying a character that is already ready does not resolve,
  // so the Cloak must stay where it is (or the ready character must not be a legal choice).
  it("131012:A:2 does not move the Cloak to a character that was already ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: NORI, seat: 0 }], attached: [{ code: HOOD, host: NORI }], allies: [{ code: FILI, seat: 0 }] });
    const [nori, hood, fili] = [idsOf(tab, NORI), idsOf(tab, HOOD), idsOf(tab, FILI)];
    expect(tab.state.cards[fili]?.exhausted).toBe(false);
    const result = reduce(tab.state, { type: "Trigger", cardId: hood, effectId: "131012:action:1" }, tab.ctx);
    // The Action is refused: nothing is changed, which the card allows.
    if (!result.ok) return;
    let run: Run = { state: result.state, steps: [...result.steps] };
    if (choices(run.state, tab).includes(fili)) run = send(run, { type: "Choose", optionId: fili }, tab.ctx);
    expect(run.state.cards[hood]?.host).toBe(nori);
    expect(run.state.cards[fili]?.attachments).not.toContain(hood);
  });
});

describe("Cram, Spare Hood and Cloak, Thrór's Map (131011:A:1, 131012:A:1, 131013:A:1)", () => {
  // "Attach to a hero."
  for (const [code, line] of [[CRAM, "131011:A:1"], [MAP, "131013:A:1"]] as const) {
    lineSpec(line, "goes on a hero and not on an ally", (effects) => {
      const tab = table(effects, { heroes: [{ code: THORIN, seat: 0 }, { code: ORI, seat: 0 }], allies: [{ code: FILI, seat: 0 }], hand: [{ code, seat: 0 }] });
      expect(onto(tab, code, idsOf(tab, FILI))).not.toBeNull();
      expect(onto(tab, code, idsOf(tab, THORIN))).toBeNull();
    });
  }

  // "Attach to a character." The engine's default attach rule already admits a character and refuses an enemy, so the record changes
  // nothing a table shows and this is a plain test (no lineSpec).
  it("131012:A:1 goes on a hero or an ally and not on an enemy", () => {
    const effects = EFFECTS;
    const tab = table(effects, { heroes: [{ code: NORI, seat: 0 }], allies: [{ code: FILI, seat: 0 }], hand: [{ code: HOOD, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(onto(tab, HOOD, idsOf(tab, WEAK))).not.toBeNull();
    expect(onto(tab, HOOD, idsOf(tab, FILI))).toBeNull();
    expect(onto(tab, HOOD, idsOf(tab, NORI))).toBeNull();
  });
});


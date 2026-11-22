// Rules: rr.ownership-and-control, rr.first-player, rr.resource-phase, rr.step-1-2, rr.response, rr.action, rr.forced, rr.search, rr.attachment-cards,
// rr.step-3-2, rr.step-6-4-2, rr.refresh-phase (data/rules/entries.json).
// The Over Hill and Under Hill heroes, allies and attachments, written from their card text (data/cards; data/printed holds no ledger for this box yet): Bilbo Baggins 131001:A:1 and A:2,
// Thorin Oakenshield 131002:A:1, Nori 131003:A:1, Ori 131004:A:1, Beorn 131005:A:1 and A:3, Fili 131006:A:1, Kili 131007:A:1, Bofur 131008:A:1,
// Gandalf 131010:A:1 and A:2, Cram 131011:A:1, Spare Hood and Cloak 131012:A:1, Thrór's Map 131013:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, enter, fillers, passAll, playCode, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

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

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([BILBO, THORIN, NORI, ORI, BEORN, FILI, KILI, BOFUR, GANDALF, CRAM, HOOD, MAP, STEWARD, AXE]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// The reason the attachment cannot be played on the host, or null when it can.
function onto(tab: Table, code: string, hostId: string): string | null {
  const card = idsOf(tab, code);
  return refusal(tab.state, { type: "PlayCard", cardId: card, hostId, payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
}

describe("Bilbo Baggins (131001:A:1, A:2)", () => {
  // "The first player gains control of Bilbo Baggins."
  lineSpec("131001:A:1", "the first player takes control of him, and he follows the first player token", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THORIN, seat: 0 }, { code: BILBO, seat: 1 }, { code: NORI, seat: 1 }] });
    const bilbo = idsOf(tab, BILBO);
    let run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[bilbo]?.controller).toBe(0);
    expect(run.state.seats[0]?.heroes).toContain(bilbo);
    run = sendUnledgered(begin({ ...run.state, firstPlayer: 1 }), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[bilbo]?.controller).toBe(1);
  });

  // "Bilbo Baggins cannot gain resources from player card effects."
  lineSpec("131001:A:2", "gains no resource from a player card effect", (effects) => {
    const tab = table(effects, { heroes: [{ code: BILBO, seat: 0 }, { code: THORIN, seat: 0 }], attached: [{ code: STEWARD, host: BILBO }] }, 0);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STEWARD), effectId: "01026:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, STEWARD)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, BILBO)]?.resources).toBe(0);
  });

  it("131001:A:2 still collects his resource in the resource phase (a framework step, not a player card effect)", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BILBO, seat: 0 }, { code: THORIN, seat: 0 }], playerDeck: fillers("card", 3) }, 0);
    const run = enter(tab.state, tab, "beginRound");
    expect(run.state.cards[idsOf(tab, BILBO)]?.resources).toBe(1);
  });
});

describe("Thorin Oakenshield (131002:A:1) and Ori (131004:A:1)", () => {
  // Thorin, Nori and Ori, and Fili and Kili when `allies` is 2: five Dwarf characters.
  function dwarves(effects: readonly Effect[], allies: number): Table {
    const all = [FILI, KILI].slice(0, allies).map((code) => ({ code, seat: 0 }));
    return table(effects, { heroes: [{ code: THORIN, seat: 0 }, { code: NORI, seat: 0 }, { code: ORI, seat: 0 }], allies: all, playerDeck: fillers("card", 6) }, 0);
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
    let run = playCode(tab, KILI);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, NORI), effectId: "131003:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(threat - 1);
  });

  it("131003:A:1 is not offered after an ally that is not a Dwarf, or a Dwarf put into play from the deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: NORI, seat: 0 }, { code: THORIN, seat: 0 }], hand: [{ code: "ally", seat: 0 }, { code: FILI, seat: 0 }], playerDeck: [{ code: KILI, seat: 0 }] });
    const plain = playCode(tab, "ally");
    expect(triggers(plain.state, tab)).not.toContain("131003:response:1");
    // Fili is played from the hand: Nori answers it. Fili's Response then puts Kili into play from the deck, which is not playing him from the hand.
    const threat = plain.state.seats[0]?.threat ?? 0;
    let run = playCode(tab, FILI, plain);
    expect(triggers(run.state, tab).sort()).toEqual(["131003:response:1", "131006:response:1"]);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, NORI), effectId: "131003:response:1" }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, FILI), effectId: "131006:response:1" }, tab.ctx);
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
    let run = passAll(enter(tab.state, tab, "combatStart"), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: beorn }, tab.ctx);
    expect(run.state.cards[beorn]?.exhausted).toBe(false);
  });
});

describe("Fili and Kili (131006:A:1, 131007:A:1)", () => {
  // "Response: After you play Fili from your hand during the planning phase, search your deck for Kili and put him into play under your control. Then, shuffle your deck."
  // Kili's line is the same with the names swapped.
  for (const [code, other, line, effect] of [[FILI, KILI, "131006:A:1", "131006:response:1"], [KILI, FILI, "131007:A:1", "131007:response:1"]] as const) {
    lineSpec(line, `after it is played in the planning phase, puts the other brother from the deck into play`, (effects) => {
      const deck = [{ code: "card", seat: 0 }, { code: other, seat: 0 }, ...fillers("card", 4)];
      const tab = table(effects, { heroes: [{ code: THORIN, seat: 0 }, { code: NORI, seat: 0 }], hand: [{ code, seat: 0 }], playerDeck: deck });
      const brother = idsOf(tab, other);
      const cursor = tab.state.seedCursor;
      let run = playCode(tab, code);
      run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, code), effectId: effect }, tab.ctx);
      if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: brother }, tab.ctx);
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
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, BOFUR), effectId: "131008:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BOFUR)]?.exhausted).toBe(true);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).not.toContain(idsOf(tab, STEWARD));
      expect(choices(run.state, tab)).not.toContain(deeper);
      run = sendUnledgered(run, { type: "Choose", optionId: axe ?? "" }, tab.ctx);
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
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [gandalf, idsOf(tab, THORIN)] }, tab.ctx);
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
    if (choices(run.state, tab).includes("discard")) run = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GANDALF)]?.zone).toBe("discard");
    // The refresh phase raised the threat by its own 1 only.
    expect(run.state.seats[0]?.threat).toBe(9);
  });

  lineSpec("131010:A:2", "stays in play when the player raises their threat by 2", (effects) => {
    const { tab, run: ended } = refreshEnds(effects);
    expect(choices(ended.state, tab).sort()).toEqual(["cancel", "discard"]);
    const run = sendUnledgered(ended, { type: "Choose", optionId: "cancel" }, tab.ctx);
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
  // so a ready character is no choice: with no exhausted other character the Action is not offered at all, and nothing is exhausted for it.
  it("131012:A:2 is not offered while every other character is ready, and nothing is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: NORI, seat: 0 }], attached: [{ code: HOOD, host: NORI }], allies: [{ code: FILI, seat: 0 }] });
    const [nori, hood, fili] = [idsOf(tab, NORI), idsOf(tab, HOOD), idsOf(tab, FILI)];
    expect(tab.state.cards[fili]?.exhausted).toBe(false);
    expect(triggers(tab.state, tab)).not.toContain("131012:action:1");
    expect(refusal(tab.state, { type: "Trigger", cardId: hood, effectId: "131012:action:1" }, tab.ctx)).toBe("That effect cannot be triggered");
    expect(tab.state.cards[hood]?.exhausted).toBe(false);
    expect(tab.state.cards[nori]?.exhausted).toBe(false);
  });

  // "Action: Exhaust Spare Hood and Cloak and exhaust attached character to ready another character. Then, attach Spare Hood and Cloak to that character."
  lineSpec("131012:A:2", "readies an exhausted character and moves the Cloak to it", (effects) => {
    const scene = table(effects, { heroes: [{ code: NORI, seat: 0 }], attached: [{ code: HOOD, host: NORI }], allies: [{ code: FILI, seat: 0 }] });
    const [nori, hood, fili] = [idsOf(scene, NORI), idsOf(scene, HOOD), idsOf(scene, FILI)];
    const tab = { ...scene, state: updateCard(scene.state, fili, { exhausted: true }) };
    expect(triggers(tab.state, tab)).toContain("131012:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: hood, effectId: "131012:action:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: fili }, tab.ctx);
    expect(run.state.cards[fili]?.exhausted).toBe(false);
    expect(run.state.cards[nori]?.exhausted).toBe(true);
    expect(run.state.cards[hood]?.exhausted).toBe(true);
    expect(run.state.cards[hood]?.host).toBe(fili);
    expect(run.state.cards[nori]?.attachments).not.toContain(hood);
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


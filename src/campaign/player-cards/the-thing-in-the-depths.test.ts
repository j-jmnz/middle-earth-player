// Rules: rr.surge, rr.response, rr.limits, rr.lasting-effects, rr.action, rr.resource-phase, rr.cost, rr.attachment-cards, rr.modifiers,
// rr.hit-points, rr.quest-phase, rr.step-3-4, rr.play-restrictions-and-permissions, rr.triggered-ability (data/rules/entries.json).
// The Thing in the Depths player cards, each printed line tested from the words on the card (data/cards/TitD.json: data/printed holds no
// ledger for this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Lanwyn 12030:A:2,
// Captain's Wisdom 12032:A:1, Master Ironsmith 12033:A:1, Raiment of War 12034:A:2, Sam Gamgee 12035:A:1, Elevenses 12036:A:1,
// Mirkwood Explorer 12037:A:1, Guarded Ceaselessly 12038:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { chooseIfAsked, choices, discarded, enter, hosts, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const LANWYN = "12030";
const WISDOM = "12032";
const IRONSMITH = "12033";
const RAIMENT = "12034";
const SAM = "12035";
const ELEVENSES = "12036";
const EXPLORER = "12037";
const GUARDED = "12038";
// Core Aragorn (Leadership, Noble Ranger), Gimli (Tactics, Dwarf Noble Warrior), Beravor (Lore, Ranger, not Noble), Denethor (Lore, Noble).
const ARAGORN = "01001";
const GIMLI = "01004";
const THALIN = "01006";
const BERAVOR = "01012";
const DENETHOR = "01010";
const EOWYN = "01007";
// Snowbourn Scout (a Scout ally), Wandering Took (a Hobbit ally), Gondorian Spearman (a Warrior ally).
const SNOWBOURN = "01016";
const TOOK = "01043";
const SPEARMAN = "01029";
// Blade of Gondolin (a Weapon), Citadel Plate (Armor), Horn of Gondor (an Item that is neither), all Tactics attachments.
const BLADE = "01039";
const PLATE = "01040";
const HORN = "01042";
// Frodo Baggins, the hero of the saga box (scene.ts FRODO), and a Hobbit hero not named Frodo.
const FRODO = "141001";
const PAL = "pal";
// Stand-ins: an encounter location with surge and one without, a location to attach to, an enemy.
const SURGER = "surger";
const GLADE = "glade";
const WEAK = "weak";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [LANWYN, WISDOM, IRONSMITH, RAIMENT, SAM, ELEVENSES, EXPLORER, GUARDED, ARAGORN, GIMLI, THALIN, BERAVOR, DENETHOR, EOWYN, SNOWBOURN, TOOK, SPEARMAN, BLADE, PLATE, HORN];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(SURGER, definePrinted({ code: SURGER, name: "Surger", type: "location", threat: 0, questPoints: 9, keywords: { surge: true } }));
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 2, questPoints: 5 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// The quest's commit is sent with `ids`, then the first player passes it: the staging step reveals the encounter deck's top card.
function staged(tab: Table, ids: readonly string[]) {
  return sendUnledgered(sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [...ids] }, tab.ctx), { type: "Pass" }, tab.ctx);
}

describe("Lanwyn (12030:A:2)", () => {
  // "Response: After an encounter card with surge is revealed, either ready Lanwyn or give her +2 Willpower until the end of the phase.":
  // Lanwyn commits (she exhausts); the staging step reveals the Surger, and she is readied.
  lineSpec("12030:A:2", "Lanwyn: after a card with surge is revealed, ready her", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: LANWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], deck: [SURGER, GLADE, GLADE] });
    const lanwyn = idsOf(tab, LANWYN);
    let run = staged(tab, [lanwyn]);
    expect(run.state.cards[lanwyn]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("12030:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: lanwyn, effectId: "12030:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["ready", "willpower"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    expect(run.state.cards[lanwyn]?.exhausted).toBe(false);
    expect(stat(run.state, tab, lanwyn, "willpower")).toBe(printed(tab, LANWYN, "willpower"));
  });

  // The other choice: +2 Willpower, which lasts the quest phase and is gone in the next one.
  lineSpec("12030:A:2", "Lanwyn: or +2 Willpower until the end of the phase", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: LANWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], deck: [SURGER, GLADE, GLADE] });
    const lanwyn = idsOf(tab, LANWYN);
    let run = staged(tab, [lanwyn]);
    run = sendUnledgered(run, { type: "Trigger", cardId: lanwyn, effectId: "12030:response:1" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "willpower" }, tab.ctx);
    expect(run.state.cards[lanwyn]?.exhausted).toBe(true);
    expect(stat(run.state, tab, lanwyn, "willpower")).toBe(printed(tab, LANWYN, "willpower") + 2);
    expect(stat(withMode(run.state, "travel"), tab, lanwyn, "willpower")).toBe(printed(tab, LANWYN, "willpower"));
  });

  // A card with no surge revealed: no Response.
  it("12030:A:2 Lanwyn: no Response after a card without surge is revealed", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: LANWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], deck: [GLADE, GLADE] });
    const run = staged(tab, [idsOf(tab, LANWYN)]);
    expect(run.state.cards[tab.ids[GLADE]?.[0] ?? ""]?.zone).toBe("staging");
    expect(triggers(run.state, tab)).not.toContain("12030:response:1");
  });

  // "(Limit twice per phase.)": three cards with surge revealed in one staging step; the Response is used on the first two and is not
  // offered for the third.
  it("12030:A:2 Lanwyn: limit twice per phase", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: LANWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], deck: [SURGER, SURGER, SURGER, GLADE, GLADE] });
    const lanwyn = idsOf(tab, LANWYN);
    let run = staged(tab, [lanwyn]);
    for (let use = 0; use < 2; use += 1) {
      expect(triggers(run.state, tab)).toContain("12030:response:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: lanwyn, effectId: "12030:response:1" }, tab.ctx);
      run = sendUnledgered(run, { type: "Choose", optionId: "willpower" }, tab.ctx);
    }
    const third = tab.ids[SURGER]?.[2] ?? "";
    expect(run.state.cards[third]?.zone).toBe("staging");
    expect(triggers(run.state, tab)).not.toContain("12030:response:1");
    expect(stat(run.state, tab, lanwyn, "willpower")).toBe(printed(tab, LANWYN, "willpower") + 4);
  });
});

describe("Captain's Wisdom (12032:A:1)", () => {
  // "Resource Action: Exhaust a Noble hero you control to add 2 resources to that hero's resource pool.": in the resource phase, Aragorn
  // and Denethor (Noble) are offered; Beravor (not Noble) and the other player's Gimli (Noble) are not. Denethor exhausts and gets 2.
  lineSpec("12032:A:1", "Captain's Wisdom: exhaust a Noble hero you control to add 2 resources to it", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: GIMLI, seat: 1 }], hand: [{ code: WISDOM, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 1 }] });
    const [aragorn, denethor] = [idsOf(tab, ARAGORN), idsOf(tab, DENETHOR)];
    let run = enter(tab.state, tab, "resourceActions");
    expect(run.state.phase).toBe("Resource");
    const before = run.state.cards[denethor]?.resources ?? 0;
    run = play(run, tab, idsOf(tab, WISDOM));
    expect(choices(run.state, tab).sort()).toEqual([aragorn, denethor].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: denethor }, tab.ctx);
    expect(run.state.cards[denethor]?.exhausted).toBe(true);
    expect(run.state.cards[denethor]?.resources).toBe(before + 2);
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
  });

  // "Resource Action": not played in the planning phase.
  it("12032:A:1 Captain's Wisdom: not played outside the resource phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: WISDOM, seat: 0 }] });
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, WISDOM))).toBe(false);
  });

  // With the only Noble hero exhausted, the cost cannot be paid: the card is not played.
  it("12032:A:1 Captain's Wisdom: not played when no Noble hero you control is ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: WISDOM, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }] });
    const run = enter(updateCard(tab.state, idsOf(tab, ARAGORN), { exhausted: true }), tab, "resourceActions");
    expect(legalIntents(run.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, WISDOM))).toBe(false);
  });
});

describe("Master Ironsmith (12033:A:1)", () => {
  // Gimli and Thalin (Tactics) hold 6 resources each; the Ironsmith costs 3.
  function scene(effects: readonly Effect[], hand: readonly string[], discard: readonly string[] = []) {
    const start = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: THALIN, seat: 0 }], hand: [{ code: IRONSMITH, seat: 0 }, ...hand.map((code) => ({ code, seat: 0 }))] });
    return discarded(start, discard.map((code) => [code, 0] as const));
  }
  const byGimli = (tab: Table) => ({ type: "PlayCard" as const, cardId: idsOf(tab, IRONSMITH), payments: [{ heroId: idsOf(tab, GIMLI), amount: 3 }] });

  // "Response: After you play Master Ironsmith from your hand, if you paid all of its resource cost from a single hero's resource pool,
  // attach a Weapon or Armor attachment from your hand ... to that hero without paying its resource cost.": Gimli pays all 3; the Blade
  // of Gondolin (Weapon) from the hand goes on Gimli, and Gimli's pool keeps the 3 left.
  lineSpec("12033:A:1", "Master Ironsmith: paid by one hero, a Weapon from the hand is attached to that hero for free", (effects) => {
    const { tab } = scene(effects, [BLADE, HORN]);
    const [gimli, blade] = [idsOf(tab, GIMLI), idsOf(tab, BLADE)];
    let run = sendUnledgered(begin(tab.state), byGimli(tab), tab.ctx);
    expect(triggers(run.state, tab)).toContain("12033:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, IRONSMITH), effectId: "12033:response:1" }, tab.ctx);
    // The Blade is the lone Weapon or Armor (the Horn of Gondor is an Item, neither), so a question, if asked, has it as its answer.
    run = chooseIfAsked(chooseIfAsked(chooseIfAsked(run, tab, "hand"), tab, blade), tab, gimli);
    expect(run.state.cards[blade]).toMatchObject({ zone: "play", host: gimli });
    expect(run.state.cards[idsOf(tab, HORN)]?.zone).toBe("hand");
    expect(run.state.cards[gimli]?.resources).toBe(3);
    expect(run.state.cards[idsOf(tab, THALIN)]?.resources).toBe(6);
  });

  // "... from your hand or discard pile": Citadel Plate (Armor) from the discard pile goes on Gimli.
  it("12033:A:1 Master Ironsmith: an Armor attachment from the discard pile", () => {
    const { tab, ids: [plate = ""] } = scene(EFFECTS, [], [PLATE]);
    const gimli = idsOf(tab, GIMLI);
    let run = sendUnledgered(begin(tab.state), byGimli(tab), tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, IRONSMITH), effectId: "12033:response:1" }, tab.ctx);
    run = chooseIfAsked(chooseIfAsked(chooseIfAsked(run, tab, "discard"), tab, plate), tab, gimli);
    expect(run.state.cards[plate]).toMatchObject({ zone: "play", host: gimli });
    expect(run.state.cards[gimli]?.resources).toBe(3);
  });

  // Paid 2 by Gimli and 1 by Thalin: not all of it from a single hero, so the Response can change nothing and is not offered
  // (rr.triggered-ability).
  // FAULT: the card's condition fails when two heroes paid; the engine still offers the Response, which then does nothing.
  it.fails("12033:A:1 Master Ironsmith: no Response when two heroes paid", () => {
    const { tab } = scene(EFFECTS, [BLADE]);
    const intent = { type: "PlayCard" as const, cardId: idsOf(tab, IRONSMITH), payments: [{ heroId: idsOf(tab, GIMLI), amount: 2 }, { heroId: idsOf(tab, THALIN), amount: 1 }] };
    const run = sendUnledgered(begin(tab.state), intent, tab.ctx);
    expect(run.state.cards[idsOf(tab, IRONSMITH)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("12033:response:1");
  });
});

describe("Raiment of War (12034:A:2)", () => {
  // "Attached character gets +1 Attack, +1 Defense and +2 hit points.": played from the hand on the Gondorian Spearman (a Warrior ally).
  lineSpec("12034:A:2", "Raiment of War: attached character gets +1 Attack, +1 Defense and +2 hit points", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: RAIMENT, seat: 0 }] });
    const spearman = idsOf(tab, SPEARMAN);
    const run = play(begin(tab.state), tab, idsOf(tab, RAIMENT), spearman);
    expect(run.state.cards[idsOf(tab, RAIMENT)]?.host).toBe(spearman);
    expect(stat(run.state, tab, spearman, "attack")).toBe(printed(tab, SPEARMAN, "attack") + 1);
    expect(stat(run.state, tab, spearman, "defense")).toBe(printed(tab, SPEARMAN, "defense") + 1);
    expect(stat(run.state, tab, spearman, "hitPoints")).toBe(printed(tab, SPEARMAN, "health") + 2);
    expect(stat(run.state, tab, idsOf(tab, GIMLI), "attack")).toBe(printed(tab, GIMLI, "attack"));
  });
});

describe("Sam Gamgee (12035:A:1)", () => {
  // "Reduce the cost to play Sam Gamgee by 2 if you control Frodo Baggins.": 1 with Frodo, 3 with only the Pal (a Hobbit not named Frodo),
  // and 3 when the other player controls Frodo.
  lineSpec("12035:A:1", "Sam Gamgee: costs 2 less while you control Frodo Baggins", (effects) => {
    const own = table(effects, { heroes: [{ code: FRODO, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: SAM, seat: 0 }] });
    expect(playCost(own.state, idsOf(own, SAM), 0, own.ctx)).toBe(1);
    const none = table(effects, { heroes: [{ code: PAL, seat: 0 }], hand: [{ code: SAM, seat: 0 }] });
    expect(playCost(none.state, idsOf(none, SAM), 0, none.ctx)).toBe(3);
  });

  it("12035:A:1 Sam Gamgee: Frodo controlled by the other player does not lower the cost", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: FRODO, seat: 1 }], hand: [{ code: SAM, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, SAM), 0, tab.ctx)).toBe(3);
  });
});

describe("Elevenses (12036:A:1)", () => {
  // "Play only after the staging step.": Éowyn (Spirit) pays; with the Wandering Took questing, Elevenses is not played in the commit step, and is played once
  // the staging step is over.
  lineSpec("12036:A:1", "Elevenses: played only after the staging step", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: PAL, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: TOOK, seat: 0 }], hand: [{ code: ELEVENSES, seat: 0 }], deck: [GLADE, GLADE] });
    const [took, elevenses] = [idsOf(tab, TOOK), idsOf(tab, ELEVENSES)];
    const playable = (state: typeof tab.state) => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === elevenses);
    const committed = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [took, idsOf(tab, PAL)] }, tab.ctx);
    expect(committed.state.cards[took]?.committed).toBe(true);
    expect(playable(committed.state)).toBe(false);
    const run = sendUnledgered(committed, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[tab.ids[GLADE]?.[0] ?? ""]?.zone).toBe("staging");
    expect(playable(run.state)).toBe(true);
  });
});

describe("Mirkwood Explorer (12037:A:1)", () => {
  // "Response: After Mirkwood Explorer quests successfully, place 1 progress on it.": the Explorer and Denethor quest (Willpower 3) against
  // the Weak (Threat 1); the quest succeeds and the Explorer gets 1 progress.
  lineSpec("12037:A:1", "Mirkwood Explorer: after it quests successfully, place 1 progress on it", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: EXPLORER, seat: 0 }], deck: [WEAK, WEAK] });
    const explorer = idsOf(tab, EXPLORER);
    let run = staged(tab, [explorer, idsOf(tab, DENETHOR)]);
    for (let guard = 0; guard < 6 && !triggers(run.state, tab).includes("12037:response:1") && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("12037:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: explorer, effectId: "12037:response:1" }, tab.ctx);
    expect(run.state.cards[explorer]?.progress).toBe(1);
  });

  // The quest fails (Willpower 2 against Threat 4): no Response.
  it("12037:A:1 Mirkwood Explorer: no Response when the quest fails", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: EXPLORER, seat: 0 }], staging: [GLADE, GLADE], deck: [WEAK, WEAK] });
    let run = staged(tab, [idsOf(tab, EXPLORER)]);
    for (let guard = 0; guard < 6 && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
      expect(triggers(run.state, tab)).not.toContain("12037:response:1");
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    }
    expect(run.state.phase).not.toBe("Quest");
    expect(run.state.cards[idsOf(tab, EXPLORER)]?.progress ?? 0).toBe(0);
  });
});

describe("Guarded Ceaselessly (12038:A:1, A:2)", () => {
  // "Attach to a location.": the Glade in the staging area and the active location are offered; a hero, an ally and an enemy are not.
  lineSpec("12038:A:1", "Guarded Ceaselessly: Attach to a location", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], staging: [GLADE, WEAK], active: SURGER, hand: [{ code: GUARDED, seat: 0 }] });
    const guarded = idsOf(tab, GUARDED);
    expect(hosts(tab, guarded)).toEqual([idsOf(tab, GLADE), idsOf(tab, SURGER)].sort());
    expect(play(begin(tab.state), tab, guarded, idsOf(tab, GLADE)).state.cards[guarded]?.host).toBe(idsOf(tab, GLADE));
  });

  // "Action: Exhaust a Ranger or Scout character to give attached location -2 Threat until the end of the phase.": Beravor (Ranger) and
  // the Snowbourn Scout are offered, the plain ally and the other player's Aragorn (Ranger) are not; the Scout exhausts, the Glade is at
  // Threat 0 for the planning phase and back to 2 in the next.
  lineSpec("12038:A:2", "Guarded Ceaselessly: exhaust a Ranger or Scout to give the location -2 Threat until the end of the phase", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 1 }], allies: [{ code: SNOWBOURN, seat: 0 }, { code: ALLY, seat: 0 }], staging: [GLADE], hand: [{ code: GUARDED, seat: 0 }] });
    const [guarded, glade, scout] = [idsOf(tab, GUARDED), idsOf(tab, GLADE), idsOf(tab, SNOWBOURN)];
    let run = play(begin(tab.state), tab, guarded, glade);
    expect(triggers(run.state, tab)).toContain("12038:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: guarded, effectId: "12038:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, BERAVOR), scout].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: scout }, tab.ctx);
    expect(run.state.cards[scout]?.exhausted).toBe(true);
    expect(stat(run.state, tab, glade, "threat")).toBe(0);
    expect(stat(withMode(run.state, "questCommit"), tab, glade, "threat")).toBe(2);
  });

  // With no ready Ranger or Scout character, the Action is not offered.
  it("12038:A:2 Guarded Ceaselessly: not offered with no ready Ranger or Scout", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }], staging: [GLADE], hand: [{ code: GUARDED, seat: 0 }] });
    const run = play(begin(updateCard(tab.state, idsOf(tab, BERAVOR), { exhausted: true })), tab, idsOf(tab, GUARDED), idsOf(tab, GLADE));
    expect(triggers(run.state, tab)).not.toContain("12038:action:1");
  });
});


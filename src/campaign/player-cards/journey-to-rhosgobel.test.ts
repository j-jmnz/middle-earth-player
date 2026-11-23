// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.action, rr.forced, rr.triggered-ability, rr.limits, rr.cost,
// rr.move, rr.explored, rr.first-player, rr.resources, rr.step-1-2, rr.step-3-4, rr.destroy (data/rules/entries.json).
// The Journey to Rhosgobel player cards, written from their card text (data/cards/JtR.json; data/printed holds no ledger for this pack, so
// every intent goes through sendUnledgered): Prince Imrahil 02050:A:1, Dúnedain Quest 02051:A:1 to A:3, Parting Gifts 02052:A:1,
// Landroval 02053:A:2, To the Eyrie 02054:A:1, Escort from Edoras 02055:A:1 and A:2, Ancient Mathom 02056:A:1 and A:2, Radagast 02059:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, enter, fillers, hosts, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const IMRAHIL = "02050";
const QUEST = "02051";
const GIFTS = "02052";
const LANDROVAL = "02053";
const EYRIE = "02054";
const ESCORT = "02055";
const MATHOM = "02056";
const RADAGAST = "02059";
// Winged Guardian: a Tactics Eagle ally of cost 2.
const GUARDIAN = "02004";
// Squire's Helm: "Attach to an ally. Restricted."
const HELM = "19003";
// Core heroes: Théodred (Leadership), Gimli and Legolas (Tactics), Éowyn (Spirit), Denethor (Lore). Gondorian Spearman: a Tactics ally
// that is not a Creature.
const THEODRED = "01002";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const SPEARMAN = "01029";
// Green Hill Country: a location of 3 quest points in scenario 1's encounter deck.
const GREEN_HILL = "141036";
const WEAK = "weak";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [IMRAHIL, QUEST, GIFTS, LANDROVAL, EYRIE, ESCORT, MATHOM, RADAGAST, GUARDIAN, HELM, THEODRED, GIMLI, LEGOLAS, EOWYN, DENETHOR, SPEARMAN, GREEN_HILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 3 }));
  base = { ...starter, cards };
});

// The card `id` is destroyed (9 damage), and a Pass lets the game resolve what that set off.
const destroyed = (state: Table["state"], tab: Table, id: string): Run => sendUnledgered(begin(placeDamage(state, id, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);

describe("Prince Imrahil (02050:A:1)", () => {
  // Imrahil exhausted, two allies of the player and one of the other player's, and a Weak enemy engaged.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: IMRAHIL, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }], engaged: [{ code: WEAK, seat: 0 }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, IMRAHIL), { exhausted: true }) };
  }

  // "Response: After a character leaves play, ready Prince Imrahil. (Limit once per round.)": the other player's ally is destroyed and
  // Imrahil readies. Exhausted again, he is offered nothing when a second character leaves play that round.
  lineSpec("02050:A:1", "Prince Imrahil: readies after a character leaves play, once per round", (effects) => {
    const tab = scene(effects);
    const imrahil = idsOf(tab, IMRAHIL);
    const [first = "", second = "", other = ""] = tab.ids[ALLY] ?? [];
    let run = destroyed(tab.state, tab, other);
    expect(run.state.cards[other]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("02050:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: imrahil, effectId: "02050:response:1" }, tab.ctx);
    expect(run.state.cards[imrahil]?.exhausted).toBe(false);
    const again = destroyed(updateCard(run.state, imrahil, { exhausted: true }), tab, first);
    expect(again.state.cards[first]?.zone).toBe("discard");
    expect(triggers(again.state, tab)).not.toContain("02050:response:1");
    expect(again.state.cards[second]?.zone).toBe("play");
  });

  // An enemy is not a character: its destruction offers nothing.
  it("02050:A:1 Prince Imrahil: no Response when an enemy leaves play", () => {
    const tab = scene(EFFECTS);
    const run = destroyed(tab.state, tab, idsOf(tab, WEAK));
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("02050:response:1");
  });
});

describe("Dúnedain Quest (02051:A:1 to A:3)", () => {
  // "Attach to a hero.": Théodred, Denethor and the other player's hero; not an ally.
  lineSpec("02051:A:1", "Dúnedain Quest: Attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: QUEST, seat: 0 }] });
    const quest = idsOf(tab, QUEST);
    expect(hosts(tab, quest)).toEqual([idsOf(tab, THEODRED), idsOf(tab, DENETHOR), idsOf(tab, PAL)].sort());
  });

  // "Attached hero gains +1 Willpower": played on Denethor, he has 1 + 1; Théodred keeps his.
  lineSpec("02051:A:2", "Dúnedain Quest: the attached hero gets +1 Willpower", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: QUEST, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, QUEST), idsOf(tab, DENETHOR));
    expect(stat(run.state, tab, idsOf(tab, DENETHOR), "willpower")).toBe(printed(tab, DENETHOR, "willpower") + 1);
    expect(stat(run.state, tab, idsOf(tab, THEODRED), "willpower")).toBe(printed(tab, THEODRED, "willpower"));
  });

  // "Action: Pay 1 resource from attached hero's pool to attach Dúnedain Quest to another hero.": on Théodred (2 resources), it moves to
  // the chosen Denethor (the other player's hero was a choice, Théodred was not); Théodred pays 1 and the +1 Willpower goes with it.
  lineSpec("02051:A:3", "Dúnedain Quest: 1 resource from the hero's pool moves it to another hero", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: QUEST, seat: 0 }] }, 2);
    const [theodred, denethor, quest] = [idsOf(scene, THEODRED), idsOf(scene, DENETHOR), idsOf(scene, QUEST)];
    const tab = attach(scene, [[quest, theodred]]);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: quest, effectId: "02051:action:1", payments: [{ heroId: theodred, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([denethor, idsOf(tab, PAL)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: denethor }, tab.ctx);
    expect(run.state.cards[quest]?.host).toBe(denethor);
    expect(run.state.cards[theodred]?.resources).toBe(1);
    expect(stat(run.state, tab, denethor, "willpower")).toBe(printed(tab, DENETHOR, "willpower") + 1);
    expect(stat(run.state, tab, theodred, "willpower")).toBe(printed(tab, THEODRED, "willpower"));
  });

  // With no resource in the attached hero's pool, or no other hero, the Action is not offered.
  it("02051:A:3 Dúnedain Quest: not offered with an empty pool or no other hero", () => {
    const empty = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: QUEST, seat: 0 }] }, 0);
    const poor = attach(empty, [[idsOf(empty, QUEST), idsOf(empty, THEODRED)]]);
    expect(triggers(poor.state, poor)).not.toContain("02051:action:1");
    const alone = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }], allies: [{ code: QUEST, seat: 0 }] }, 2);
    const lone = attach(alone, [[idsOf(alone, QUEST), idsOf(alone, THEODRED)]]);
    expect(triggers(lone.state, lone)).not.toContain("02051:action:1");
  });
});

describe("Parting Gifts (02052:A:1)", () => {
  // "Action: Move any number of resource tokens from a Leadership hero's resource pool to any other hero's resource pool.": the sources
  // are the Leadership heroes Théodred and Imrahil (not Denethor, Lore); the destination any other hero, here the other player's Gimli,
  // who gets 3 of Théodred's 4.
  lineSpec("02052:A:1", "Parting Gifts: moves resources from a Leadership hero to another hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: IMRAHIL, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 1 }], hand: [{ code: GIFTS, seat: 0 }] }, 4);
    const [theodred, imrahil, denethor, gimli] = [idsOf(tab, THEODRED), idsOf(tab, IMRAHIL), idsOf(tab, DENETHOR), idsOf(tab, GIMLI)];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, GIFTS), payments: [] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([theodred, imrahil].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: theodred }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([imrahil, denethor, gimli].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gimli }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "3" }, tab.ctx);
    expect(run.state.cards[theodred]?.resources).toBe(1);
    expect(run.state.cards[gimli]?.resources).toBe(4 + 3);
  });

  // With no resource on a Leadership hero (Denethor, Lore, holds some), there is nothing to move: it is not played.
  it("02052:A:1 Parting Gifts: not played when no Leadership hero has a resource", () => {
    const scene = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: GIFTS, seat: 0 }] }, 0);
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, DENETHOR), { resources: 3 }) };
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, GIFTS))).toBe(false);
  });
});

describe("Landroval (02053:A:2)", () => {
  // "Landroval cannot have restricted attachments.": Squire's Helm ("Attach to an ally. Restricted.") may go on another ally, not on him.
  lineSpec("02053:A:2", "Landroval: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODRED, seat: 0 }], allies: [{ code: LANDROVAL, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HELM, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, HELM))).toEqual([idsOf(tab, ALLY)]);
  });
});

describe("To the Eyrie (02054:A:1)", () => {
  // Legolas pays; Landroval and the Winged Guardian (Eagles) and an ally are in play, the other player's Winged Guardian too.
  function scene(effects: readonly Effect[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: LANDROVAL, seat: 0 }, { code: GUARDIAN, seat: 0 }, { code: ALLY, seat: 0 }, { code: GUARDIAN, seat: 1 }], hand: [{ code: EYRIE, seat: 0 }] });
  }

  // "Response: After an ally is destroyed, exhaust 1 Eagle character to move that ally from the discard pile to its owner's hand.": the
  // ally is destroyed; the choice is the player's ready Eagles (not the other player's Guardian); Landroval exhausts and the ally goes to
  // its owner's hand.
  lineSpec("02054:A:1", "To the Eyrie: exhausts an Eagle to return the destroyed ally to its owner's hand", (effects) => {
    const tab = scene(effects);
    const [ally, landroval, legolas] = [idsOf(tab, ALLY), idsOf(tab, LANDROVAL), idsOf(tab, LEGOLAS)];
    const [mine = ""] = tab.ids[GUARDIAN] ?? [];
    let run = destroyed(tab.state, tab, ally);
    expect(run.state.cards[ally]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("02054:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, EYRIE), effectId: "02054:response:1", payments: [{ heroId: legolas, amount: 2 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([landroval, mine].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: landroval }, tab.ctx);
    expect(run.state.cards[landroval]?.exhausted).toBe(true);
    expect(run.state.cards[mine]?.exhausted).toBe(false);
    expect(run.state.cards[ally]?.zone).toBe("hand");
    expect(run.state.seats[0]?.hand).toContain(ally);
    expect(run.state.cards[legolas]?.resources).toBe(6 - 2);
  });

  // With every Eagle of the player exhausted, the cost cannot be paid: no Response. A hero destroyed is not an ally: no Response.
  it("02054:A:1 To the Eyrie: not offered with no ready Eagle, nor for a hero", () => {
    const tab = scene(EFFECTS);
    const [mine = ""] = tab.ids[GUARDIAN] ?? [];
    const tired = updateCard(updateCard(tab.state, idsOf(tab, LANDROVAL), { exhausted: true }), mine, { exhausted: true });
    expect(triggers(destroyed(tired, tab, idsOf(tab, ALLY)).state, tab)).not.toContain("02054:response:1");
    expect(triggers(destroyed(tab.state, tab, idsOf(tab, PAL)).state, tab)).not.toContain("02054:response:1");
  });
});

describe("Escort from Edoras (02055:A:1, A:2)", () => {
  // The quest phase with Éowyn and two Escorts in play; the encounter deck holds enemies of threat 0.
  function scene(effects: readonly Effect[]): Table {
    return table(effects, { start: "quest", heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: ESCORT, seat: 0 }, { code: ESCORT, seat: 0 }], deck: ["f0", "f0"] });
  }

  // "While committed to a quest, Escort from Edoras gets +2 Willpower": the committed Escort has 2 + 2, the other one 2.
  lineSpec("02055:A:1", "Escort from Edoras: +2 Willpower while committed", (effects) => {
    const tab = scene(effects);
    const [committed = "", home = ""] = tab.ids[ESCORT] ?? [];
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [committed] }, tab.ctx);
    expect(run.state.cards[committed]?.committed).toBe(true);
    expect(stat(run.state, tab, committed, "willpower")).toBe(printed(tab, ESCORT, "willpower") + 2);
    expect(stat(run.state, tab, home, "willpower")).toBe(printed(tab, ESCORT, "willpower"));
  });

  // "Forced: After resolving a quest to which Escort from Edoras was committed, discard Escort from Edoras from play.": the quest resolves;
  // the committed Escort is discarded, the one that stayed back is still in play.
  lineSpec("02055:A:2", "Escort from Edoras: discarded after the quest it was committed to resolves", (effects) => {
    const tab = scene(effects);
    const [committed = "", home = ""] = tab.ids[ESCORT] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [committed, idsOf(tab, EOWYN)] }, tab.ctx);
    for (let guard = 0; guard < 20 && run.state.phase === "Quest" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.phase).not.toBe("Quest");
    expect(run.state.cards[committed]?.zone).toBe("discard");
    expect(run.state.cards[home]?.zone).toBe("play");
  });
});

describe("Ancient Mathom (02056:A:1, A:2)", () => {
  // "Attach to a location.": the staged and the active Green Hill Country; not a hero.
  lineSpec("02056:A:1", "Ancient Mathom: Attach to a location", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], staging: [GREEN_HILL], active: GREEN_HILL, hand: [{ code: MATHOM, seat: 0 }] });
    const mathom = idsOf(tab, MATHOM);
    expect(hosts(tab, mathom)).toEqual([...(tab.ids[GREEN_HILL] ?? [])].sort());
    const [staged = ""] = tab.ids[GREEN_HILL] ?? [];
    expect(play(begin(tab.state), tab, mathom, staged).state.cards[mathom]?.host).toBe(staged);
  });

  // "Response: After attached location is explored, the first player draws 3 cards.": the active location with the Mathom is explored by
  // the quest; the first player (the second seat) draws 3, the Mathom's own player draws none.
  lineSpec("02056:A:2", "Ancient Mathom: the first player draws 3 when the location is explored", (effects) => {
    const scene = table(effects, { seats: 2, start: "quest", heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: MATHOM, seat: 0 }], active: GREEN_HILL, playerDeck: [...fillers(CARD, 4), ...fillers(CARD, 4, 1)], deck: ["f0", "f0"] });
    const location = idsOf(scene, GREEN_HILL);
    const tab = attach({ ...scene, state: { ...updateCard(scene.state, location, { progress: 2 }), firstPlayer: 1 } }, [[idsOf(scene, MATHOM), location]]);
    const hands = tab.state.seats.map((seat) => seat.hand.length);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EOWYN)] }, tab.ctx);
    for (let guard = 0; guard < 20 && !triggers(run.state, tab).includes("02056:response:1") && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[location]?.zone).not.toBe("activeLocation");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MATHOM), effectId: "02056:response:1" }, tab.ctx);
    expect(run.state.seats[1]?.hand.length).toBe((hands[1] ?? 0) + 3);
    expect(run.state.seats[0]?.hand.length).toBe(hands[0]);
  });
});

describe("Radagast (02059:A:1)", () => {
  // "Radagast collects 1 resource each resource phase. These resources can be used to pay for Creature cards played from your hand.":
  // after the resource phase's gain step Radagast holds 1; with it and 4 of Legolas's, Landroval (a Creature) is played; the Gondorian
  // Spearman (not a Creature) cannot take Radagast's resource.
  lineSpec("02059:A:1", "Radagast: collects 1 resource a round and pays only for Creature cards", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: RADAGAST, seat: 0 }], hand: [{ code: LANDROVAL, seat: 0 }, { code: SPEARMAN, seat: 0 }], playerDeck: fillers(CARD, 3) }, 4);
    const [radagast, legolas] = [idsOf(tab, RADAGAST), idsOf(tab, LEGOLAS)];
    const granted = enter(tab.state, tab, "resourceGrant");
    expect(granted.state.cards[radagast]?.resources).toBe(1);
    const planning = enter(granted.state, tab, "planning").state;
    expect(refusal(planning, { type: "PlayCard", cardId: idsOf(tab, SPEARMAN), payments: [{ heroId: radagast, amount: 1 }, { heroId: legolas, amount: 1 }] }, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(planning), { type: "PlayCard", cardId: idsOf(tab, LANDROVAL), payments: [{ heroId: radagast, amount: 1 }, { heroId: legolas, amount: 4 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, LANDROVAL)]?.zone).toBe("play");
    expect(run.state.cards[radagast]?.resources).toBe(0);
  });
});

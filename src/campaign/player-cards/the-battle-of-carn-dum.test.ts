// Rules: rr.resource-match, rr.resource-phase, rr.engaged, rr.modifiers, rr.sentinel, rr.restricted, rr.enters-play, rr.ready, bts.valour,
// rr.response, rr.drawing-cards, rr.play-restrictions-and-permissions, rr.lasting-effects, faq.lasting-effects, rr.attachment-cards, rr.limits
// (data/rules/entries.json).
// The Battle of Carn Dûm player cards, each line tested from the words on the card: Amarthiúl 10115:A:1 and A:2, Guardian of Arnor 10116:A:2,
// Beechbone 10118:A:1, Hold Your Ground! 10119:A:1 and A:2, Lindir 10120:A:1, Lords of the Eldar 10121:A:1 and A:2, The Long Defeat
// 10122:A:1, Favor of the Valar 10124:A:1. The lines are the text of data/cards/BoCD.json (data/printed holds no entry for this pack), so
// every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, discarded, endRound, enter, fillers, hosts, play, playCode, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const AMARTHIUL = "10115";
const GUARDIAN = "10116";
const BEECHBONE = "10118";
const HOLD = "10119";
const LINDIR = "10120";
const LORDS = "10121";
const LONG_DEFEAT = "10122";
const FAVOR = "10124";
// Arwen Undómiel: a Spirit Noldor hero.
const ARWEN = "10140";
// Core Aragorn (Leadership, sentinel), Legolas (Tactics, Silvan), Glorfindel (Lore, Noldor), Denethor (Lore, Gondor).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const GLORFINDEL = "01011";
const DENETHOR = "01010";
// Gondorian Spearman: a Tactics ally of cost 2 with sentinel. Veteran Axehand: a Tactics ally with no keyword.
const SPEARMAN = "01029";
const AXEHAND = "01028";
// Raiment of the Second Age: "Attach to a character. Restricted."
const RAIMENT = "10191";
const WEAK = "weak";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [AMARTHIUL, GUARDIAN, BEECHBONE, HOLD, LINDIR, LORDS, LONG_DEFEAT, FAVOR, ARWEN, ARAGORN, LEGOLAS, GLORFINDEL, DENETHOR, SPEARMAN, AXEHAND, RAIMENT];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

// `count` Weak enemies engaged with `seat`.
const engagedWith = (count: number, seat = 0) => Array.from({ length: count }, () => ({ code: WEAK, seat }));
// The card ids a PlayCard intent is offered for.
const playable = (tab: Table, state = tab.state) => legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));

describe("Amarthiúl (10115:A:1, A:2)", () => {
  // "While you are engaged with at least 1 enemy, Amarthiúl gains the Tactics resource icon.": with no enemy engaged he cannot pay for the
  // Gondorian Spearman (Tactics) alone; once he engages an enemy through the Engage intent, he can.
  lineSpec("10115:A:1", "Amarthiúl: gains the Tactics icon once his player engages an enemy", (effects) => {
    const tab = table(effects, { start: "encounter", heroes: [{ code: AMARTHIUL, seat: 0 }], staging: [WEAK], hand: [{ code: SPEARMAN, seat: 0 }] });
    const [amarthiul, spearman] = [idsOf(tab, AMARTHIUL), idsOf(tab, SPEARMAN)];
    const byHim = { type: "PlayCard", cardId: spearman, payments: [{ heroId: amarthiul, amount: 2 }] } as const;
    const planning = (state: typeof tab.state) => ({ ...state, phase: "Planning" as const, boundaryPhase: "Planning" as const, mode: "planning" as const, window: { kind: "pass" as const }, activeSeat: 0 });
    expect(refusal(planning(tab.state), byHim, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WEAK) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).toBe("engaged");
    expect(refusal(planning(run.state), byHim, tab.ctx)).toBeNull();
  });

  // "you are engaged": an enemy engaged with the other player gives him no icon.
  it("10115:A:1 Amarthiúl: an enemy engaged with another player gives no Tactics icon", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: AMARTHIUL, seat: 0 }, { code: PAL, seat: 1 }], engaged: engagedWith(1, 1), hand: [{ code: SPEARMAN, seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, SPEARMAN), payments: [{ heroId: idsOf(tab, AMARTHIUL), amount: 2 }] }, tab.ctx)).not.toBeNull();
  });

  // "While you are engaged with at least 2 enemies, add 1 additional resource to Amarthiúl's resource pool when you collect resources during
  // the resource phase.": engaged with 2 he collects 2, Aragorn beside him 1.
  lineSpec("10115:A:2", "Amarthiúl: collects 1 more resource while engaged with 2 enemies", (effects) => {
    const tab = table(effects, { heroes: [{ code: AMARTHIUL, seat: 0 }, { code: ARAGORN, seat: 0 }], engaged: engagedWith(2), playerDeck: fillers(CARD, 3) }, 0);
    const run = enter(tab.state, tab, "beginRound");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(1);
    expect(run.state.cards[idsOf(tab, AMARTHIUL)]?.resources).toBe(2);
  });

  // Engaged with 1 enemy, and with the other player's second enemy, he collects 1.
  it("10115:A:2 Amarthiúl: collects 1 resource with 1 enemy engaged with him and 1 with another player", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: AMARTHIUL, seat: 0 }, { code: PAL, seat: 1 }], engaged: [...engagedWith(1, 0), ...engagedWith(1, 1)], playerDeck: [...fillers(CARD, 3), ...fillers(CARD, 3, 1)] }, 0);
    const run = enter(tab.state, tab, "beginRound");
    expect(run.state.cards[idsOf(tab, AMARTHIUL)]?.resources).toBe(1);
  });
});

describe("Guardian of Arnor (10116:A:2)", () => {
  // "Guardian of Arnor gets +1 Defense for each enemy engaged with you.": played from the hand while 2 enemies are engaged with his player and
  // 1 with the other player, he has Defense 1 + 2.
  lineSpec("10116:A:2", "Guardian of Arnor: +1 Defense for each enemy engaged with his player only", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], engaged: [...engagedWith(2, 0), ...engagedWith(1, 1)], hand: [{ code: GUARDIAN, seat: 0 }] });
    const guardian = idsOf(tab, GUARDIAN);
    const run = play(begin(tab.state), tab, guardian);
    expect(run.state.cards[guardian]?.zone).toBe("play");
    expect(stat(run.state, tab, guardian, "defense")).toBe(1 + 2);
  });
});

describe("Beechbone (10118:A:1)", () => {
  // "Cannot have restricted attachments. Enters play exhausted.": played from the hand he is exhausted, and the Raiment of the Second Age
  // (a restricted attachment for any character) may go on the Veteran Axehand but not on him.
  lineSpec("10118:A:1", "Beechbone: enters play exhausted", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: BEECHBONE, seat: 0 }] });
    const beechbone = idsOf(tab, BEECHBONE);
    const run = play(begin(tab.state), tab, beechbone);
    expect(run.state.cards[beechbone]).toMatchObject({ zone: "play", exhausted: true });
  });

  lineSpec("10118:A:1", "Beechbone: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: BEECHBONE, seat: 0 }, { code: AXEHAND, seat: 0 }], hand: [{ code: RAIMENT, seat: 0 }] });
    const raiment = idsOf(tab, RAIMENT);
    expect(hosts(tab, raiment)).toContain(idsOf(tab, AXEHAND));
    expect(hosts(tab, raiment)).not.toContain(idsOf(tab, BEECHBONE));
  });
});

describe("Hold Your Ground! (10119:A:1, A:2)", () => {
  // Two exhausted Gondorian Spearmen (sentinel), an exhausted Veteran Axehand (no sentinel), Legolas (Tactics) to pay, and the event in hand;
  // the other player's exhausted Spearman and Aragorn (sentinel).
  function scene(effects: readonly Effect[], threat: number): { tab: Table; mine: string[]; axehand: string; theirs: string; aragorn: string } {
    const start = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 1 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: AXEHAND, seat: 0 }, { code: SPEARMAN, seat: 1 }], hand: [{ code: HOLD, seat: 0 }] });
    const [first = "", second = "", theirs = ""] = start.ids[SPEARMAN] ?? [];
    const [axehand, aragorn] = [idsOf(start, AXEHAND), idsOf(start, ARAGORN)];
    let state = withThreat(start.state, 0, threat);
    for (const id of [first, second, theirs, axehand, aragorn]) state = updateCard(state, id, { exhausted: true });
    return { tab: { ...start, state }, mine: [first, second], axehand, theirs, aragorn };
  }

  // "Action: Choose and ready a sentinel character.": the exhausted sentinel characters of both players are offered, the Axehand is not; the
  // chosen Spearman readies, the rest stay exhausted.
  lineSpec("10119:A:1", "Hold Your Ground!: readies the chosen sentinel character only", (effects) => {
    const { tab, mine, axehand, theirs, aragorn } = scene(effects, 20);
    const [first = "", second = ""] = mine;
    let run = playCode(tab, HOLD);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([first, second, theirs, aragorn].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: second }, tab.ctx);
    expect(run.state.cards[second]?.exhausted).toBe(false);
    for (const id of [first, theirs, aragorn, axehand]) expect(run.state.cards[id]?.exhausted).toBe(true);
  });

  // With no exhausted sentinel character, the Action can change nothing, and below threat 40 there is no Valour Action: the card is not offered.
  it("10119:A:1 Hold Your Ground!: not offered when no sentinel character is exhausted", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: AXEHAND, seat: 0 }], hand: [{ code: HOLD, seat: 0 }] });
    const state = updateCard(tab.state, idsOf(tab, AXEHAND), { exhausted: true });
    expect(playable(tab, state)).not.toContain(idsOf(tab, HOLD));
  });

  // "Valour Action: Ready all sentinel characters." (bts.valour: at threat 40 the player picks one of the two effects): every sentinel character
  // of both players readies; the Axehand stays exhausted.
  lineSpec("10119:A:2", "Hold Your Ground!: at threat 40 readies every sentinel character", (effects) => {
    const { tab, mine, axehand, theirs, aragorn } = scene(effects, 40);
    let run = playCode(tab, HOLD);
    expect(run.state.window?.kind).toBe("choose");
    const options = choices(run.state, tab);
    expect(options.sort()).toEqual(["10119:action:1", "10119:action:2"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "10119:action:2" }, tab.ctx);
    for (const id of [...mine, theirs, aragorn]) expect(run.state.cards[id]?.exhausted).toBe(false);
    expect(run.state.cards[axehand]?.exhausted).toBe(true);
  });
});

describe("Lindir (10120:A:1)", () => {
  // "Response: After Lindir enters play, if you have less than 3 cards in your hand, draw until you have 3 cards in your hand.": played with 1
  // other card in hand, he draws 2.
  lineSpec("10120:A:1", "Lindir: after he enters play with 1 card in hand, draws 2", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARWEN, seat: 0 }], hand: [{ code: LINDIR, seat: 0 }, { code: CARD, seat: 0 }], playerDeck: fillers(CARD, 5) });
    const lindir = idsOf(tab, LINDIR);
    let run = play(begin(tab.state), tab, lindir);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(triggers(run.state, tab)).toContain("10120:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: lindir, effectId: "10120:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.seats[0]?.deck).toHaveLength(3);
  });

  // With 3 other cards in hand, the condition is false: no Response.
  it("10120:A:1 Lindir: no Response with 3 cards in hand", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARWEN, seat: 0 }], hand: [{ code: LINDIR, seat: 0 }, ...fillers(CARD, 3)], playerDeck: fillers(CARD, 5) });
    const run = play(begin(tab.state), tab, idsOf(tab, LINDIR));
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(triggers(run.state, tab)).not.toContain("10120:response:1");
  });
});

it("10120:A:1 Lindir: no Response with an empty deck", () => {
  const tab = table(EFFECTS, { heroes: [{ code: ARWEN, seat: 0 }], hand: [{ code: LINDIR, seat: 0 }] });
  const run = play(begin(tab.state), tab, idsOf(tab, LINDIR));
  expect(run.state.seats[0]?.deck).toEqual([]);
  expect(triggers(run.state, tab)).not.toContain("10120:response:1");
});

describe("Lords of the Eldar (10121:A:1, A:2)", () => {
  // Arwen (Spirit, Noldor) and Legolas (Silvan) for the first player, Glorfindel (Noldor) for the second, with Lords of the Eldar in the first
  // player's discard pile or hand.
  function scene(effects: readonly Effect[], where: "discard" | "hand"): { tab: Table; lords: string } {
    const start = table(effects, { seats: 2, heroes: [{ code: ARWEN, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: GLORFINDEL, seat: 1 }], hand: where === "hand" ? [{ code: LORDS, seat: 0 }] : [], playerDeck: fillers(CARD, 2) });
    if (where === "hand") return { tab: start, lords: idsOf(start, LORDS) };
    const { tab, ids: [lords = ""] } = discarded(start, [[LORDS, 0]]);
    return { tab, lords };
  }

  // "Lords of the Eldar can only be played from your discard pile.": in the hand it is not offered, in the discard pile it is.
  lineSpec("10121:A:1", "Lords of the Eldar: played from the discard pile, not from the hand", (effects) => {
    const inHand = scene(effects, "hand");
    expect(playable(inHand.tab)).not.toContain(inHand.lords);
    const inDiscard = scene(effects, "discard");
    expect(playable(inDiscard.tab)).toContain(inDiscard.lords);
  });

  // "Action: Place Lords of the Eldar on the bottom of your deck from your discard pile. Then, until the end of the round all Noldor characters
  // get +1 Willpower, +1 Attack, and +1 Defense.": the card goes to the bottom of the deck; Arwen and the other player's Glorfindel get the
  // bonus, Legolas does not, and it ends with the round.
  lineSpec("10121:A:2", "Lords of the Eldar: to the bottom of the deck, then +1/+1/+1 to every Noldor character until the end of the round", (effects) => {
    const { tab, lords } = scene(effects, "discard");
    const [arwen, legolas, glorfindel] = [idsOf(tab, ARWEN), idsOf(tab, LEGOLAS), idsOf(tab, GLORFINDEL)];
    const run = play(begin(tab.state), tab, lords);
    expect(run.state.cards[lords]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck.at(-1)).toBe(lords);
    expect(run.state.seats[0]?.discard).not.toContain(lords);
    for (const [id, code] of [[arwen, ARWEN], [glorfindel, GLORFINDEL]] as const) {
      const card = tab.ctx.cards.get(code);
      expect([stat(run.state, tab, id, "willpower"), stat(run.state, tab, id, "attack"), stat(run.state, tab, id, "defense")]).toEqual([(card?.willpower ?? 0) + 1, (card?.attack ?? 0) + 1, (card?.defense ?? 0) + 1]);
    }
    expect(stat(run.state, tab, legolas, "attack")).toBe(tab.ctx.cards.get(LEGOLAS)?.attack ?? 0);
    const later = enter(run.state, tab, "questCommit");
    expect(stat(later.state, tab, arwen, "willpower")).toBe((tab.ctx.cards.get(ARWEN)?.willpower ?? 0) + 1);
    const ended = endRound(run.state, tab);
    expect(stat(ended.state, tab, arwen, "willpower")).toBe(tab.ctx.cards.get(ARWEN)?.willpower ?? 0);
  });

  // A lasting effect of a player card is fixed when it resolves (faq.lasting-effects): Lindir (Noldor), played after it, gets nothing.
  it("10121:A:2 Lords of the Eldar: a Noldor character that enters play later gets no bonus", () => {
    const start = table(EFFECTS, { heroes: [{ code: ARWEN, seat: 0 }], hand: [{ code: LINDIR, seat: 0 }], playerDeck: fillers(CARD, 4) });
    const { tab, ids: [lords = ""] } = discarded(start, [[LORDS, 0]]);
    const [arwen, lindir] = [idsOf(tab, ARWEN), idsOf(tab, LINDIR)];
    let run = play(begin(tab.state), tab, lords);
    run = play(run, tab, lindir);
    expect(run.state.cards[lindir]?.zone).toBe("play");
    expect(stat(run.state, tab, lindir, "willpower")).toBe(tab.ctx.cards.get(LINDIR)?.willpower ?? 0);
    expect(stat(run.state, tab, arwen, "willpower")).toBe((tab.ctx.cards.get(ARWEN)?.willpower ?? 0) + 1);
  });
});

describe("The Long Defeat (10122:A:1)", () => {
  // "Attach to a quest card in play. Limit 1 per quest.": the current quest card is its one host (no hero); a second copy has no host once the
  // first is attached.
  lineSpec("10122:A:1", "The Long Defeat: attaches to the quest card in play, 1 per quest", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: LONG_DEFEAT, seat: 0 }, { code: LONG_DEFEAT, seat: 0 }] });
    const quest = tab.state.questStage ?? Object.values(tab.state.cards).find((card) => card.zone === "questStage")?.id ?? "";
    const [first = "", second = ""] = tab.ids[LONG_DEFEAT] ?? [];
    expect(hosts(tab, first)).toEqual([quest]);
    const run = play(begin(tab.state), tab, first, quest);
    expect(run.state.cards[first]?.host).toBe(quest);
    expect(hosts(tab, second, run.state)).toEqual([]);
  });
});

describe("Favor of the Valar (10124:A:1)", () => {
  // "Attach to a player's threat dial. Limit 1 per player.": each player's dial is offered; once the first player's holds a copy, only the
  // second player's is.
  lineSpec("10124:A:1", "Favor of the Valar: goes on a player's threat dial, 1 per player", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: FAVOR, seat: 0 }, { code: FAVOR, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[FAVOR] ?? [];
    expect(hosts(tab, first)).toEqual(["seat:0", "seat:1"]);
    const run = play(begin(tab.state), tab, first, "seat:0");
    expect(run.state.cards[first]).toMatchObject({ zone: "play", host: null, controller: 0 });
    expect(hosts(tab, second, run.state)).toEqual(["seat:1"]);
  });
});


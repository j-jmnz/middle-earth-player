// Rules: rr.action, rr.event-cards, rr.doomed-x, rr.drawing-cards, rr.lasting-effects, rr.step-6-4a, rr.may, rr.search,
// rr.in-player-order (data/rules/entries.json).
// The Voice of Isengard events, each printed line tested from the words on the card (data/cards/VoI.json: data/printed holds no ledger
// for this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Legacy of Númenor 07011:A:2,
// Deep Knowledge 07012:A:2, The Wizards's Voice 07013:A:2, Power of Orthanc 07014:A:2, The Seeing-stone 07015:A:2.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../rules/core/printed.ts";
import { EFFECTS } from "../../effects/index.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf } from "../../../test/harness/scene.ts";
import { atDefense, canPlay, choices, combat, fillers, passAll, play, playerTableFor, sendUnledgered } from "../../../test/harness/player-table.ts";

const LEGACY = "07011";
const DEEP = "07012";
const VOICE = "07013";
const POWER = "07014";
const STONE = "07015";
// Core Aragorn (Leadership), Gimli (Tactics), Éowyn (Spirit), Denethor (Lore).
const ARAGORN = "01001";
const GIMLI = "01004";
const EOWYN = "01007";
const DENETHOR = "01010";
// The Favor of the Lady and Unexpected Courage: Spirit Condition attachments. Celebrían's Stone: an Item that is not a Condition.
const FAVOR = "01055";
const COURAGE = "01057";
const STONE_ITEM = "01027";
const BRUTE = "brute";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [LEGACY, DEEP, VOICE, POWER, STONE, ARAGORN, GIMLI, EOWYN, DENETHOR, FAVOR, COURAGE, STONE_ITEM];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

// Whether the engine offers to play `cardId` from the hand.

describe("Legacy of Númenor (07011:A:2)", () => {
  // "Action: Add 1 resource to each hero's resource pool.": Aragorn pays 0; each hero of both players gets 1 (Doomed 4 raises each threat).
  lineSpec("07011:A:2", "Legacy of Númenor: each hero gets 1 resource", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: LEGACY, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, LEGACY));
    expect(run.state.cards[idsOf(tab, LEGACY)]?.zone).toBe("discard");
    for (const code of [ARAGORN, GIMLI, PAL]) expect(run.state.cards[idsOf(tab, code)]?.resources).toBe(6 + 1);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([8 + 4, 6 + 4]);
  });
});

describe("Deep Knowledge (07012:A:2)", () => {
  // "Action: Each player draws 2 cards.": both players draw 2.
  lineSpec("07012:A:2", "Deep Knowledge: each player draws 2 cards", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: DEEP, seat: 0 }], playerDeck: [...fillers(PLAIN, 3), ...fillers(PLAIN, 3, 1)] });
    const run = play(begin(tab.state), tab, idsOf(tab, DEEP));
    expect(run.state.seats.map((seat) => seat.hand.length)).toEqual([2, 2]);
    expect(run.state.seats.map((seat) => seat.deck.length)).toEqual([1, 1]);
  });

  // Both decks empty: no player can draw, so the Action can change nothing and the card is not played (rr.triggered-ability).
  it("07012:A:2 Deep Knowledge: not played when every deck is empty", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: DEEP, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, DEEP))).toBe(false);
  });
});

describe("The Wizards's Voice (07013:A:2)", () => {
  // "Action: Each player chooses 1 enemy engaged with him. Until the end of the phase, each chosen enemy cannot attack the player that
  // chose it.": played at the start of the combat phase, each player's lone engaged Brute is chosen; no enemy attacks, and the phase
  // moves past the enemy attacks.
  lineSpec("07013:A:2", "The Wizards's Voice: each chosen enemy cannot attack the player that chose it", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: VOICE, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }, { code: BRUTE, seat: 1 }] });
    let run = play(combat(tab.state, tab), tab, idsOf(tab, VOICE));
    expect(run.state.cards[idsOf(tab, VOICE)]?.zone).toBe("discard");
    run = passAll(run, tab.ctx);
    expect(run.state.window?.kind).not.toBe("defense");
    expect(run.state.window?.kind).not.toBe("chooseEnemy");
    expect(run.steps.filter((step) => step.kind === "attack" && step.side === "enemy")).toEqual([]);
  });

  // No enemy engaged with any player: nothing to choose, so the card is not played.
  it("07013:A:2 The Wizards's Voice: not played with no enemy engaged", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: VOICE, seat: 0 }], staging: [BRUTE] });
    expect(canPlay(tab.state, tab, idsOf(tab, VOICE))).toBe(false);
  });

  // "Until the end of the phase": played in the planning phase, the Brute cannot attack the player for that phase; the effect is over
  // when the combat phase begins, and the Brute attacks.
  it("07013:A:2 The Wizards's Voice: played in the planning phase, it is over by the combat phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: VOICE, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    const played = play(begin(tab.state), tab, idsOf(tab, VOICE));
    expect(played.state.cards[idsOf(tab, VOICE)]?.zone).toBe("discard");
    expect(played.state.modifiers).toContainEqual(expect.objectContaining({ instanceId: idsOf(tab, BRUTE), stat: "cannotAttack", until: "endOfPhase", seat: 0 }));
    atDefense(tab, played.state);
  });
});

describe("Power of Orthanc (07014:A:2)", () => {
  // "Action: Each player may choose and discard a Condition attachment from play.": the first player discards the Unexpected Courage
  // on the other player's hero (Celebrían's Stone, not a Condition, is not offered); the other player chooses not to, and the Favor of
  // the Lady stays.
  lineSpec("07014:A:2", "Power of Orthanc: each player may choose and discard a Condition attachment", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 1 }], attached: [{ code: FAVOR, host: EOWYN }, { code: COURAGE, host: ARAGORN }, { code: STONE_ITEM, host: EOWYN }], hand: [{ code: POWER, seat: 0 }] });
    const [favor, courage, item] = [idsOf(tab, FAVOR), idsOf(tab, COURAGE), idsOf(tab, STONE_ITEM)];
    let run = play(begin(tab.state), tab, idsOf(tab, POWER));
    expect(choices(run.state, tab).sort()).toEqual(["discard", "skip"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([favor, courage].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: courage }, tab.ctx);
    expect(run.state.cards[courage]?.zone).toBe("discard");
    // The other player's turn to choose: the Favor is the lone Condition left; they skip.
    expect(choices(run.state, tab).sort()).toEqual(["discard", "skip"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "skip" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[favor]?.zone).toBe("play");
    expect(run.state.cards[item]?.zone).toBe("play");
  });

  // No Condition attachment in play: each player can only skip, so the card can change nothing and is not played.
  it("07014:A:2 Power of Orthanc: not played with no Condition attachment in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], attached: [{ code: STONE_ITEM, host: EOWYN }], hand: [{ code: POWER, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, POWER))).toBe(false);
  });
});

describe("The Seeing-stone (07015:A:2)", () => {
  // "Action: Search your deck for a card with the Doomed keyword and add it to your hand. Shuffle your deck.": Deep Knowledge and Legacy
  // of Númenor (Doomed) are offered among 12 cards, the Plain ones are not; Legacy goes to the hand and the deck is shuffled.
  lineSpec("07015:A:2", "The Seeing-stone: a Doomed card from the deck to the hand, then the deck is shuffled", (effects) => {
    const deck = [...fillers(PLAIN, 3), { code: DEEP, seat: 0 }, ...fillers(PLAIN, 5), { code: LEGACY, seat: 0 }, ...fillers(PLAIN, 2)];
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: STONE, seat: 0 }], playerDeck: deck });
    const [deep, legacy] = [idsOf(tab, DEEP), idsOf(tab, LEGACY)];
    let run = play(begin(tab.state), tab, idsOf(tab, STONE));
    expect(choices(run.state, tab).sort()).toEqual([deep, legacy].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: legacy }, tab.ctx);
    expect(run.state.cards[legacy]?.zone).toBe("hand");
    expect(run.state.cards[deep]?.zone).toBe("deck");
    const unshuffled = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== legacy);
    expect(run.state.seats[0]?.deck).toHaveLength(unshuffled.length);
    expect(run.state.seats[0]?.deck).not.toEqual(unshuffled);
  });
});

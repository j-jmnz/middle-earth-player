// Rules: rr.response, rr.limits, rr.lasting-effects, rr.in-play-and-out-of-play, rr.doomed-x, rr.action, rr.cost, rr.engaged,
// rr.search, rr.enters-play, rr.triggered-ability, rr.step-7-4 (data/rules/entries.json).
// The Voice of Isengard heroes and allies, each printed line tested from the words on the card (data/cards/VoI.json: data/printed holds no
// ledger for this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Éomer 07001:A:1, Saruman
// 07003:A:2, Orthanc Guard 07004:A:1, Isengard Messenger 07005:A:1, Westfold Outrider 07006:A:1, Westfold Horse-breeder 07007:A:1. The
// attachments are in the-voice-of-isengard-attachments.test.ts, the events in the-voice-of-isengard-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { answerFirst, choices, endRound, fillers, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const EOMER = "07001";
const SARUMAN = "07003";
const GUARD = "07004";
const MESSENGER = "07005";
const OUTRIDER = "07006";
const BREEDER = "07007";
// Deep Knowledge: "Doomed 2. Action: Each player draws 2 cards." (Lore, cost 0).
const DEEP = "07012";
// Core Denethor (Lore), Gimli (Tactics), Éowyn (Spirit), Aragorn (Leadership).
const DENETHOR = "01010";
const GIMLI = "01004";
const EOWYN = "01007";
const ARAGORN = "01001";
// Stand-ins: enemies that stay where they are put, a Mount attachment, a doomed encounter treachery, a location.
const WEAK = "weak";
const MOUNT = "mount";
const DOOM = "doom";
const GLADE = "glade";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [EOMER, SARUMAN, GUARD, MESSENGER, OUTRIDER, BREEDER, DEEP, DENETHOR, GIMLI, EOWYN, ARAGORN];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(MOUNT, definePrinted({ code: MOUNT, name: "Mount", type: "attachment", traits: ["Mount"], cost: 0 }));
  cards.set(DOOM, definePrinted({ code: DOOM, name: "Doom", type: "treachery", keywords: { doomed: 1 } }));
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 5 }));
  base = { ...starter, cards };
});

// Denethor (Lore) plays Deep Knowledge from the hand: Doomed 2 raises each player's threat by 2.
function doomedPlay(tab: Table, run = begin(tab.state), copy = 0) {
  return play(run, tab, tab.ids[DEEP]?.[copy] ?? "");
}

describe("Éomer (07001:A:1)", () => {
  // "Response: After a character leaves play, Éomer gets +2 Attack until the end of the round.": the Westfold Outrider is discarded to
  // engage the Weak (a character leaves play); Éomer gets +2 Attack, which is gone once the round has ended.
  lineSpec("07001:A:1", "Éomer: after a character leaves play, +2 Attack until the end of the round", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOMER, seat: 0 }], allies: [{ code: OUTRIDER, seat: 0 }], staging: [WEAK], playerDeck: fillers(PLAIN, 3) });
    const [eomer, outrider] = [idsOf(tab, EOMER), idsOf(tab, OUTRIDER)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: outrider, effectId: "07006:action:1" }, tab.ctx);
    expect(run.state.cards[outrider]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("07001:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: eomer, effectId: "07001:response:1" }, tab.ctx);
    expect(stat(run.state, tab, eomer, "attack")).toBe(printed(tab, EOMER, "attack") + 2);
    expect(stat(endRound(run.state, tab).state, tab, eomer, "attack")).toBe(printed(tab, EOMER, "attack"));
  });

  // "(Limit once per round.)": a second Outrider leaves play in the same round; the Response is not offered again.
  it("07001:A:1 Éomer: limit once per round", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOMER, seat: 0 }], allies: [{ code: OUTRIDER, seat: 0 }, { code: OUTRIDER, seat: 0 }], staging: [WEAK, WEAK] });
    const eomer = idsOf(tab, EOMER);
    const [first = "", second = ""] = tab.ids[OUTRIDER] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: first, effectId: "07006:action:1" }, tab.ctx);
    run = answerFirst(sendUnledgered(run, { type: "Trigger", cardId: eomer, effectId: "07001:response:1" }, tab.ctx), tab);
    run = sendUnledgered(run, { type: "Trigger", cardId: second, effectId: "07006:action:1" }, tab.ctx);
    expect(run.state.cards[second]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("07001:response:1");
    expect(stat(run.state, tab, eomer, "attack")).toBe(printed(tab, EOMER, "attack") + 2);
  });
});

describe("Saruman (07003:A:2)", () => {
  // "At the end of the round, discard Saruman from play.": Saruman in play goes to the discard pile when the round ends.
  lineSpec("07003:A:2", "Saruman: discarded from play at the end of the round", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: SARUMAN, seat: 0 }], playerDeck: fillers(PLAIN, 3) });
    const saruman = idsOf(tab, SARUMAN);
    expect(withMode(tab.state, "combatStart").cards[saruman]?.zone).toBe("play");
    expect(endRound(tab.state, tab).state.cards[saruman]?.zone).toBe("discard");
  });
});

describe("Orthanc Guard (07004:A:1)", () => {
  // "Response: After you raise your threat from the Doomed keyword, ready Orthanc Guard.": the exhausted Guard is readied after Deep
  // Knowledge (Doomed 2) raises the threat.
  lineSpec("07004:A:1", "Orthanc Guard: after you raise your threat from Doomed, ready it", (effects) => {
    const start = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: DEEP, seat: 0 }], playerDeck: fillers(PLAIN, 4) });
    const guard = idsOf(start, GUARD);
    const tab = { ...start, state: updateCard(start.state, guard, { exhausted: true }) };
    let run = doomedPlay(tab);
    expect(run.state.seats[0]?.threat).toBe(8 + 2);
    expect(triggers(run.state, tab)).toContain("07004:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: guard, effectId: "07004:response:1" }, tab.ctx);
    expect(run.state.cards[guard]?.exhausted).toBe(false);
  });

  // A ready Guard: readying it changes nothing, so the Response is not offered.
  it("07004:A:1 Orthanc Guard: not offered while it is ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: DEEP, seat: 0 }], playerDeck: fillers(PLAIN, 4) });
    const run = doomedPlay(tab);
    expect(run.state.seats[0]?.threat).toBe(8 + 2);
    expect(triggers(run.state, tab)).not.toContain("07004:response:1");
  });

  // An encounter card with Doomed revealed in the staging step also raises your threat from the Doomed keyword (rr.doomed-x).
  lineSpec("07004:A:1", "Orthanc Guard: also after a doomed encounter card is revealed", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], deck: [DOOM, GLADE] });
    const guard = idsOf(tab, GUARD);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [guard] }, tab.ctx);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    expect(run.state.cards[guard]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("07004:response:1");
  });
});

describe("Isengard Messenger (07005:A:1)", () => {
  // "Response: After you raise your threat from the Doomed keyword, Isengard Messenger gets +1 Willpower until the end of the round.
  // (Limit twice per round.)": three Deep Knowledge are played; the Response is used on the first two and not offered on the third,
  // and the +2 is gone once the round has ended.
  lineSpec("07005:A:1", "Isengard Messenger: +1 Willpower after a Doomed threat raise, twice per round", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: MESSENGER, seat: 0 }], hand: [{ code: DEEP, seat: 0 }, { code: DEEP, seat: 0 }, { code: DEEP, seat: 0 }], playerDeck: fillers(PLAIN, 10) });
    const messenger = idsOf(tab, MESSENGER);
    let run = begin(tab.state);
    for (let copy = 0; copy < 2; copy += 1) {
      run = doomedPlay(tab, run, copy);
      expect(triggers(run.state, tab)).toContain("07005:response:1");
      run = sendUnledgered(run, { type: "Trigger", cardId: messenger, effectId: "07005:response:1" }, tab.ctx);
    }
    expect(stat(run.state, tab, messenger, "willpower")).toBe(printed(tab, MESSENGER, "willpower") + 2);
    run = doomedPlay(tab, run, 2);
    expect(run.state.seats[0]?.threat).toBe(8 + 6);
    expect(triggers(run.state, tab)).not.toContain("07005:response:1");
    expect(stat(endRound(run.state, tab).state, tab, messenger, "willpower")).toBe(printed(tab, MESSENGER, "willpower"));
  });
});

describe("Isengard Messenger, a revealed Doomed card (07005:A:1)", () => {
  // An encounter card with Doomed revealed in the staging step raises the threat from the Doomed keyword (rr.doomed-x): the Messenger answers it.
  lineSpec("07005:A:1", "Isengard Messenger: +1 Willpower after a doomed encounter card is revealed", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: MESSENGER, seat: 0 }], deck: [DOOM, GLADE] });
    const messenger = idsOf(tab, MESSENGER);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [messenger] }, tab.ctx);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    expect(triggers(run.state, tab)).toContain("07005:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: messenger, effectId: "07005:response:1" }, tab.ctx);
    expect(stat(run.state, tab, messenger, "willpower")).toBe(printed(tab, MESSENGER, "willpower") + 1);
  });
});

describe("Westfold Outrider (07006:A:1)", () => {
  // Two players: a Weak in the staging area, one engaged with the other player and one engaged with the first player.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: OUTRIDER, seat: 0 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 1 }, { code: WEAK, seat: 0 }] });

  // "Action: Discard Westfold Outrider to choose an enemy not engaged with you. Engage the chosen enemy.": the enemy engaged with the
  // other player is chosen and engages the first player; the Outrider is discarded.
  lineSpec("07006:A:1", "Westfold Outrider: discard it to engage an enemy engaged with another player", (effects) => {
    const tab = scene(effects);
    const [staging = "", other = "", own = ""] = tab.ids[WEAK] ?? [];
    const outrider = idsOf(tab, OUTRIDER);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: outrider, effectId: "07006:action:1" }, tab.ctx);
    expect(run.state.cards[outrider]?.zone).toBe("discard");
    expect(choices(run.state, tab).sort()).toEqual(["otherPlayer", "staging"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "otherPlayer" }, tab.ctx);
    // A lone candidate may be taken without a question; the enemy engaged with you is never one.
    expect(choices(run.state, tab)).not.toContain(own);
    run = run.state.window?.kind === "choose" ? sendUnledgered(run, { type: "Choose", optionId: other }, tab.ctx) : run;
    expect(run.state.cards[other]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(run.state.cards[staging]?.zone).toBe("staging");
  });

  // An enemy in the staging area is chosen and engages the first player.
  it("07006:A:1 Westfold Outrider: engages an enemy in the staging area", () => {
    const tab = scene(EFFECTS);
    const [staging = ""] = tab.ids[WEAK] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, OUTRIDER), effectId: "07006:action:1" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "staging" }, tab.ctx);
    run = run.state.window?.kind === "choose" ? sendUnledgered(run, { type: "Choose", optionId: staging }, tab.ctx) : run;
    expect(run.state.cards[staging]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  // Only an enemy engaged with you: nothing to choose, so the Action is not offered and the Outrider is not discarded.
  it("07006:A:1 Westfold Outrider: not offered when every enemy is engaged with you", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: OUTRIDER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("07006:action:1");
  });
});

describe("Westfold Horse-breeder (07007:A:1)", () => {
  // The deck, top first: 2 filler cards, a Plain attachment, a Mount 4th, 6 fillers, a second Mount 11th, 3 fillers.
  const deck = [...fillers(PLAIN, 2), { code: "card", seat: 0 }, { code: MOUNT, seat: 0 }, ...fillers(PLAIN, 6), { code: MOUNT, seat: 0 }, ...fillers(PLAIN, 3)];

  // "Response: After Westfold Horse-breeder enters play, search the top 10 cards of your deck for a Mount attachment and add it to your
  // hand. Shuffle your deck.": only the Mount among the top 10 is a candidate (the 11th card and the Plain attachment are not); it goes to the hand and the deck is
  // shuffled (its order is not the one before, less the Mount).
  lineSpec("07007:A:1", "Westfold Horse-breeder: a Mount from the top 10 to the hand, then the deck is shuffled", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: BREEDER, seat: 0 }], playerDeck: deck });
    const [top = "", deep = ""] = tab.ids[MOUNT] ?? [];
    const breeder = idsOf(tab, BREEDER);
    let run = play(begin(tab.state), tab, breeder);
    expect(triggers(run.state, tab)).toContain("07007:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: breeder, effectId: "07007:response:1" }, tab.ctx);
    // The Mount among the top 10 is the lone candidate, so it is taken without a question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[top]?.zone).toBe("hand");
    expect(run.state.cards[deep]?.zone).toBe("deck");
    const unshuffled = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== top);
    expect(run.state.seats[0]?.deck).toHaveLength(unshuffled.length);
    expect(run.state.seats[0]?.deck).not.toEqual(unshuffled);
  });
});

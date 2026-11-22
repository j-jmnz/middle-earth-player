// Rules: rr.attachment-cards, rr.cost, rr.printed, rr.action, rr.then, rr.play-restrictions-and-permissions, rr.staging-area,
// rr.staging, rr.step-7-4, rr.damage, rr.triggered-ability (data/rules/entries.json).
// The Blood of Gondor attachments, each printed line tested from the words on the card (data/cards/BoG.json: data/printed holds no ledger
// for this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Tome of Atanatar 06109:A:1, A:2
// and A:3, Poisoned Stakes 06115:A:1, A:2 and A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, discarded, endRound, fillers, hosts, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const TOME = "06109";
const STAKES = "06115";
// Core Aragorn and Théodred (Leadership), Gimli (Tactics), Denethor (Lore).
const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const DENETHOR = "01010";
// For Gondor! (Leadership event, cost 2): "Until the end of the phase, all characters get +1 Attack ...". Blade Mastery (Tactics event).
const FOR_GONDOR = "01022";
const BLADE_MASTERY = "01032";
// Stand-ins: an enemy, a location, an enemy with surge.
const WEAK = "weak";
const SURGING = "surging";
const GLADE = "glade";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [TOME, STAKES, ARAGORN, THEODRED, GIMLI, DENETHOR, FOR_GONDOR, BLADE_MASTERY];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(SURGING, definePrinted({ code: SURGING, name: "Surging", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9, keywords: { surge: true } }));
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 5 }));
  base = { ...starter, cards };
});

describe("Tome of Atanatar (06109:A:1, A:2, A:3)", () => {
  // "Attach to a Leadership hero.": Aragorn and Théodred are offered; Gimli (Tactics) is not.
  lineSpec("06109:A:1", "Tome of Atanatar: Attach to a Leadership hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: TOME, seat: 0 }] });
    const tome = idsOf(tab, TOME);
    expect(hosts(tab, tome)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, THEODRED)].sort());
    expect(play(begin(tab.state), tab, tome, idsOf(tab, THEODRED)).state.cards[tome]?.host).toBe(idsOf(tab, THEODRED));
  });

  // "Reduce the cost to play Tome of Atanatar by 1 for each hero you control with a printed Leadership resource icon.": Aragorn and
  // Théodred make it 4 - 2 = 2; the other player's Leadership hero (the Pal) does not count.
  lineSpec("06109:A:2", "Tome of Atanatar: 1 less for each hero you control with a printed Leadership icon", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: TOME, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, TOME), 0, tab.ctx)).toBe(4 - 2);
    const one = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: TOME, seat: 0 }] });
    expect(playCost(one.state, idsOf(one, TOME), 0, one.ctx)).toBe(4 - 1);
  });

  // The Tome on Aragorn; `discard` in the discard pile; 2 Plain cards in the deck.
  function scene(effects: readonly Effect[], discard: readonly string[]) {
    const start = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: TOME, host: ARAGORN }], playerDeck: fillers(PLAIN, 2) });
    const made = discarded(start, discard.map((code) => [code, 0] as const));
    return { tab: attach(made.tab, []), ids: made.ids };
  }

  // "Action: Discard Tome of Atanatar to play any Leadership event card in your discard pile as if it were in your hand. Then, place that
  // event on the bottom of your deck.": For Gondor! is played from the discard pile (Aragorn pays 2): every character gets +1 Attack; the
  // Tome is discarded and For Gondor! ends on the bottom of the deck. Blade Mastery (Tactics) is never offered.
  lineSpec("06109:A:3", "Tome of Atanatar: discard it to play a Leadership event from the discard pile, then it goes to the bottom of the deck", (effects) => {
    const { tab, ids: [gondor = "", mastery = ""] } = scene(effects, [FOR_GONDOR, BLADE_MASTERY]);
    const [aragorn, gimli, tome] = [idsOf(tab, ARAGORN), idsOf(tab, GIMLI), idsOf(tab, TOME)];
    expect(triggers(tab.state, tab)).toContain("06109:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: tome, effectId: "06109:action:1" }, tab.ctx);
    expect(run.state.cards[tome]?.zone).toBe("discard");
    // For Gondor! is the lone Leadership event: it is played at once, paid by Aragorn, with no question.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(stat(run.state, tab, gimli, "attack")).toBe(printed(tab, GIMLI, "attack") + 1);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 2);
    expect(run.state.cards[gondor]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck.at(-1)).toBe(gondor);
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.cards[mastery]?.zone).toBe("discard");
  });

  // The heroes hold no resources: For Gondor! (cost 2) cannot be played, so the Action can change nothing and is not offered
  // (rr.triggered-ability), and the Tome is not discarded for nothing.
  // FAULT: no resources to pay for the only Leadership event; the engine still offers the Action, discards the Tome and leaves For Gondor! in the discard pile.
  it.fails("06109:A:3 Tome of Atanatar: not offered when the Leadership event cannot be paid for", () => {
    const start = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: TOME, host: ARAGORN }], playerDeck: fillers(PLAIN, 2) }, 0);
    const { tab } = discarded(start, [[FOR_GONDOR, 0]]);
    expect(triggers(tab.state, tab)).not.toContain("06109:action:1");
  });

  // Only a Tactics event in the discard pile: no Leadership event to play, so the Action is not offered.
  it("06109:A:3 Tome of Atanatar: not offered with no Leadership event in the discard pile", () => {
    const { tab } = scene(EFFECTS, [BLADE_MASTERY]);
    expect(triggers(tab.state, tab)).not.toContain("06109:action:1");
  });
});

describe("Poisoned Stakes (06115:A:1, A:2, A:3)", () => {
  // "Play Poisoned Stakes into the staging area unattached.": Denethor pays 2; the Stakes are in the staging area, on no card.
  lineSpec("06115:A:1", "Poisoned Stakes: played into the staging area unattached", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: STAKES, seat: 0 }], staging: [WEAK] });
    const stakes = idsOf(tab, STAKES);
    // The place it is played into is the staging area, not a card.
    expect(hosts(tab, stakes)).toEqual(["staging"]);
    const run = play(begin(tab.state), tab, stakes, "staging");
    expect(run.state.cards[stakes]).toMatchObject({ zone: "staging", host: null });
    expect(run.state.cards[idsOf(tab, WEAK)]?.attachments).toEqual([]);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.resources).toBe(6 - 2);
  });

  // The Stakes in the staging area unattached (played there), and the quest's staging step revealing `deck`.
  function staged(effects: readonly Effect[], deck: readonly string[]) {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: STAKES, seat: 0 }], deck: [...deck] });
    const stakes = idsOf(tab, STAKES);
    const placed = play(begin(tab.state), tab, stakes, "staging");
    const questTab = { ...tab, state: { ...placed.state, phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "questCommit" as const, window: { kind: "pass" as const }, activeSeat: 0 } };
    let run = sendUnledgered(begin(questTab.state), { type: "Commit", cardIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    return { tab, stakes, run };
  }

  // "If unattached, attach Poisoned Stakes to the next eligible enemy that enters the staging area.": the Surging enemy, revealed first,
  // takes the Stakes.
  lineSpec("06115:A:2", "Poisoned Stakes: attach to the next enemy that enters the staging area", (effects) => {
    const { tab, stakes, run } = staged(effects, [SURGING, WEAK, GLADE]);
    expect(run.state.cards[idsOf(tab, SURGING)]?.zone).toBe("staging");
    expect(run.state.cards[stakes]?.host).toBe(idsOf(tab, SURGING));
    // "next": the Weak, revealed after it by surge, takes nothing.
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, WEAK)]?.attachments).toEqual([]);
  });

  // A location that enters the staging area is not an eligible enemy: the Stakes stay unattached.
  it("06115:A:2 Poisoned Stakes: a location does not take them", () => {
    const { tab, stakes, run } = staged(EFFECTS, [GLADE, WEAK]);
    expect(run.state.cards[idsOf(tab, GLADE)]?.zone).toBe("staging");
    expect(run.state.cards[stakes]).toMatchObject({ zone: "staging", host: null });
  });

  // "At the end of each round, deal 2 damage to attached enemy.": the Stakes on the Weak; the round ends and the Weak has 2 damage.
  lineSpec("06115:A:3", "Poisoned Stakes: at the end of each round, 2 damage to the attached enemy", (effects) => {
    const start = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], staging: [WEAK, STAKES], playerDeck: fillers(PLAIN, 3) });
    const tab = { ...start, state: attachTo(start.state, idsOf(start, STAKES), idsOf(start, WEAK)) };
    expect(tab.state.cards[idsOf(tab, WEAK)]?.damage).toBe(0);
    expect(endRound(tab.state, tab).state.cards[idsOf(tab, WEAK)]?.damage).toBe(2);
  });

  // Unattached at the end of the round: no damage is dealt.
  it("06115:A:3 Poisoned Stakes: unattached, they deal no damage", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], staging: [WEAK, STAKES], playerDeck: fillers(PLAIN, 3) });
    expect(endRound(tab.state, tab).state.cards[idsOf(tab, WEAK)]?.damage).toBe(0);
  });
});

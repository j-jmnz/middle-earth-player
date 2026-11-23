// Rules: rr.response, rr.action, rr.cost, rr.triggered-ability, rr.resource-match, rr.shadow-effects, rr.doomed-x, rr.step-3-4, rr.active-location
// (data/rules/entries.json).
// The Antlered Crown events, written from their card text (data/cards/TAC.json; data/printed holds no ledger for this pack, so the lines are
// the text of data/cards and every intent goes through sendUnledgered): Ride Them Down 08142:A:1, Shadows Give Way 08143:A:1 and A:2, Don't
// Be Hasty! 08144:A:1, Waters of Nimrodel 08145:A:2 (its Doomed 3, 08145:A:1, is a keyword the engine reads from the card).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { choices, play, playableCards, playCode, playerTableFor, printed, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const RIDE = "08142";
const SHADOWS = "08143";
const HASTY = "08144";
const WATERS = "08145";
// Core: Legolas (Tactics), Éowyn (Spirit, Willpower 4) and Dúnhere (Spirit), Beravor (Lore, Willpower 2).
const LEGOLAS = "01005";
const EOWYN = "01007";
const DUNHERE = "01009";
const BERAVOR = "01012";
const ALLY = "ally";
const PAL = "pal";
// A Spirit hero with no text.
const SPRITE = "sprite";
// An enemy of attack 2; a non-unique enemy and a unique one of threat 0; none engages by the engagement check. A location of 2 quest
// points; a treachery to deal as a shadow card.
const BRUTE = "brute";
const RAM = "ram";
const CHIEF = "chief";
const LOC = "loc";
const BOOST = "boost";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([RIDE, SHADOWS, HASTY, WATERS, LEGOLAS, EOWYN, DUNHERE, BERAVOR]))]);
  cards.set(SPRITE, definePrinted({ code: SPRITE, name: "Sprite", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  cards.set(RAM, definePrinted({ code: RAM, name: "Ram", type: "enemy", threat: 0, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(CHIEF, definePrinted({ code: CHIEF, name: "Chief", type: "enemy", isUnique: true, threat: 0, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 0, questPoints: 2 }));
  cards.set(BOOST, definePrinted({ code: BOOST, name: "Boost", type: "treachery" }));
  base = { ...starter, cards };
});

// The ids of the PlayCard intents the engine offers.

describe("Ride Them Down (08142:A:1)", () => {
  // Éowyn (Willpower 4) commits; the Ram (non-unique, threat 0) and the Chief (unique) are in the staging area, the Loc (2 quest points) is
  // the active location, and the staging step reveals another Ram. The run stops at the quest phase's action window after staging.
  function quested(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: RIDE, seat: 0 }], staging: [RAM, CHIEF], deck: [RAM], active: LOC });
    const revealed = tab.ids[RAM]?.find((id) => tab.state.cards[id]?.zone === "encounterDeck") ?? "";
    const run = sendUnledgered(sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EOWYN)] }, tab.ctx), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[revealed]?.zone).toBe("staging");
    expect(run.state.window?.kind).toBe("frameAction");
    return { tab, run };
  }

  // Ride Them Down played on the first Ram, up to the last Pass of the quest phase's action window.
  function ridden(effects: readonly Effect[]): { tab: Table; run: Run; ram: string; other: string } {
    const { tab, run: asked } = quested(effects);
    const [ram = "", other = ""] = tab.ids[RAM] ?? [];
    let run = play(asked, tab, idsOf(tab, RIDE));
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([ram, other].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ram }, tab.ctx);
    expect(run.state.window?.kind).toBe("frameAction");
    return { tab, run, ram, other };
  }

  // "Quest Action: Choose a non-unique enemy in the staging area. Until the end of the phase, progress that would be placed on the quest from
  // questing successfully is instead assigned as damage to the chosen enemy. (Progress must still be placed on any active location first.)":
  // the Rams are offered and the Chief is not; Éowyn's 4 progress puts 2 on the active location (explored) and the other 2 as damage on the
  // chosen Ram, none on the quest.
  lineSpec("08142:A:1", "Ride Them Down: questing progress past the active location is damage on the chosen non-unique enemy", (effects) => {
    const { tab, run, ram, other } = ridden(effects);
    const stage = tab.state.questStage ?? "";
    const done = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(done.state.mode).toBe("travel");
    expect(done.state.cards[idsOf(tab, LOC)]?.zone).toBe("encounterDiscard");
    expect(done.state.cards[ram]?.damage).toBe(2);
    expect(done.state.cards[other]?.damage).toBe(0);
    expect(done.state.cards[stage]?.progress).toBe(0);
  });

  lineSpec("08142:A:1", "Ride Them Down: the damage on the chosen enemy names its cause", (effects) => {
    const { tab, run, ram } = ridden(effects);
    const done = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(done.state.cards[ram]?.damage).toBe(2);
  });

  // "Quest Action": in the planning phase it is not played.
  it("08142:A:1 Ride Them Down: not played outside the quest phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: RIDE, seat: 0 }], staging: [RAM] });
    expect(playableCards(tab.state, tab)).not.toContain(idsOf(tab, RIDE));
  });
});

describe("Shadows Give Way (08143:A:1, A:2)", () => {
  // Éowyn, Dúnhere and the Sprite (Spirit heroes); the Brute engaged with the first player and another with the second, each with a shadow
  // card, and the Ram in the staging area.
  function shadowed(effects: readonly Effect[]): { tab: Table; dealt: string[] } {
    const scene = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: DUNHERE, seat: 0 }, { code: SPRITE, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: SHADOWS, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }, { code: BRUTE, seat: 1 }], staging: [RAM] });
    let state = scene.state;
    const dealt: string[] = [];
    for (const enemy of scene.ids[BRUTE] ?? []) {
      const made = spawn(state, BOOST, { zone: "shadow", enemyId: enemy }, "down");
      state = made.state;
      dealt.push(made.id);
    }
    return { tab: { ...scene, state }, dealt };
  }

  // "You must use resources from 3 different heroes' pools to pay for this card.": its 3 from Éowyn alone, or from two heroes, is refused;
  // 1 each from Éowyn, Dúnhere and the Sprite is accepted.
  lineSpec("08143:A:1", "Shadows Give Way: paid from 3 different heroes' pools", (effects) => {
    const { tab } = shadowed(effects);
    const [eowyn, dunhere, sprite] = [idsOf(tab, EOWYN), idsOf(tab, DUNHERE), idsOf(tab, SPRITE)];
    const card = idsOf(tab, SHADOWS);
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: [{ heroId: eowyn, amount: 3 }] }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, payments: [{ heroId: eowyn, amount: 2 }, { heroId: dunhere, amount: 1 }] }, tab.ctx)).not.toBeNull();
    const intent = { type: "PlayCard" as const, cardId: card, payments: [{ heroId: eowyn, amount: 1 }, { heroId: dunhere, amount: 1 }, { heroId: sprite, amount: 1 }] };
    expect(refusal(tab.state, intent, tab.ctx)).toBeNull();
  });

  // "Action: Discard each shadow card from each enemy in play.": both shadow cards, the one on the enemy engaged with the other player too,
  // go to the encounter discard pile.
  lineSpec("08143:A:2", "Shadows Give Way: discards each shadow card from each enemy in play", (effects) => {
    const { tab, dealt } = shadowed(effects);
    const pay = [idsOf(tab, EOWYN), idsOf(tab, DUNHERE), idsOf(tab, SPRITE)].map((heroId) => ({ heroId, amount: 1 }));
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, SHADOWS), payments: pay }, tab.ctx);
    for (const enemy of tab.ids[BRUTE] ?? []) expect(run.state.cards[enemy]?.shadowId ?? null).toBeNull();
    for (const id of dealt) expect(run.state.cards[id]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idsOf(tab, SHADOWS)]?.zone).toBe("discard");
  });

  // With no shadow card on any enemy, its effect can change nothing: it is not played (rr.triggered-ability).
  it("08143:A:2 Shadows Give Way: not played when no enemy has a shadow card", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }, { code: DUNHERE, seat: 0 }, { code: SPRITE, seat: 0 }], hand: [{ code: SHADOWS, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    expect(playableCards(tab.state, tab)).not.toContain(idsOf(tab, SHADOWS));
  });
});

describe("Don't Be Hasty! (08144:A:1)", () => {
  // Beravor (Lore, pays 0) and Éowyn commit, Legolas does not; the encounter deck reveals the Ram.
  function revealed(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: BERAVOR, seat: 0 }, { code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: HASTY, seat: 0 }], deck: [RAM] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, BERAVOR), idsOf(tab, EOWYN)] }, tab.ctx);
    // The commit pass ends; the staging step reveals the Ram.
    return { tab, run: sendUnledgered(run, { type: "Pass" }, tab.ctx) };
  }

  // "Response: When an encounter card is revealed but before resolving any of that card's keywords or "when revealed" effects, choose a
  // character committed to the quest. Ready that character and remove it from the quest.": Beravor and Éowyn are offered, Legolas is not;
  // Éowyn is ready and no longer committed, Beravor stays committed and exhausted.
  lineSpec("08144:A:1", "Don't Be Hasty!: when an encounter card is revealed, ready a committed character and remove it from the quest", (effects) => {
    const { tab, run: asked } = revealed(effects);
    const [beravor, eowyn] = [idsOf(tab, BERAVOR), idsOf(tab, EOWYN)];
    expect(triggers(asked.state, tab)).toContain("08144:response:1");
    let run = sendUnledgered(asked, { type: "Trigger", cardId: idsOf(tab, HASTY), effectId: "08144:response:1", payments: [{ heroId: beravor, amount: 0 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([beravor, eowyn].sort());
    const stage = tab.state.questStage ?? "";
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(run.state.cards[eowyn]?.exhausted).toBe(false);
    expect(run.state.cards[beravor]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, HASTY)]?.zone).toBe("discard");
    // The quest then resolves with Beravor's Willpower alone (the Ram has no threat): Éowyn's 4 is not counted.
    expect(run.state.mode).toBe("travel");
    expect(run.state.cards[stage]?.progress).toBe(printed(tab, BERAVOR, "willpower"));
  });

  // "choose a character committed to the quest": with no character committed, the Response is not offered when the Ram is revealed.
  it("08144:A:1 Don't Be Hasty!: not offered when no character is committed", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: HASTY, seat: 0 }], deck: [RAM] });
    const run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, RAM)]?.zone).toBe("staging");
    expect(triggers(run.state, tab)).not.toContain("08144:response:1");
  });
});

describe("Waters of Nimrodel (08145:A:2)", () => {
  // "Action: Heal all damage on each character in play.": Beravor (Lore) pays 3; the damage on Beravor, Éowyn, an ally and the other
  // player's hero is all healed. Doomed 3 (08145:A:1, the keyword) raises each player's threat by 3.
  lineSpec("08145:A:2", "Waters of Nimrodel: heals all damage on each character in play", (effects) => {
    const start = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: WATERS, seat: 0 }] });
    const ids = [idsOf(start, BERAVOR), idsOf(start, EOWYN), idsOf(start, PAL), idsOf(start, ALLY)];
    let state = start.state;
    for (const [index, id] of ids.entries()) state = updateCard(state, id, { damage: index === 3 ? 1 : 2 });
    const tab = { ...start, state };
    const threats = state.seats.map((seat) => seat.threat);
    const run = playCode(tab, WATERS);
    for (const id of ids) expect(run.state.cards[id]?.damage).toBe(0);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual(threats.map((threat) => threat + 3));
  });

  // No character is damaged: its effect can change nothing, so it is not played (rr.triggered-ability).
  it("08145:A:2 Waters of Nimrodel: not played when no character is damaged", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: WATERS, seat: 0 }] });
    expect(playableCards(tab.state, tab)).not.toContain(idsOf(tab, WATERS));
  });
});

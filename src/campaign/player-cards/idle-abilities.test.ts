// Rules: rr.triggered-ability, rr.cost (data/rules/entries.json).
// An Action, a Response or an event whose whole effect cannot change the game as the table stands is not offered, and its cost is not paid for nothing
// (src/rules/player/potential.ts). Each card here was found offered with nothing to act on by the idle check of the card smoke (scripts/card-smoke/idle.ts):
// a table where the printed words leave nothing to do (not offered) and the nearest table where they leave something (offered). The packs have no ledger,
// so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { enter, play, playableCards, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";

const GRIM_RESOLVE = "01025";
const NORTHERN_TRACKER = "01045";
const WE_DO_NOT_SLEEP = "02101";
const CAPTAINS = "146010";
const MEN_OF_THE_WEST = "06083";
const HUNTER = "05014";
const EXPLORER = "12037";
const WARDEN = "04083";
const CEORL = "12058";
const MENDOR = "01135";
const OUTMATCHED = "19062";
const SWIFT_AND_SILENT = "08003";
const DETERMINATION = "10172";
const GANDALF = "142002";
const KNIFE_WORK = "12114";
const ELROND = "08032";
const ATHELAS = "09011";
const SHADOW = "02125";
const STALLION = "19033";
const BILL = "141006";
const RALLYING_CRY = "10003";
const HELPER = "ally";
const GIMLI = "01004";
const FOE = "f0";
const ARAGORN_LORE = "04053";
const ARAGORN = "01001";
const BERAVOR = "01012";
const ELEANOR = "01008";
const DUNHERE = "01009";
const NOBLE = "noble";
const CONDITION = "condition";
const PAL = "pal";
const RIDER = "141039";
const FORD = "141072";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (scene: Scene = {}, resources = 6): Table => playerTable(base, EFFECTS, scene, resources);
const exhaust = (tab: Table, code: string): Table => ({ ...tab, state: updateCard(tab.state, idsOf(tab, code), { exhausted: true }) });
const offeredPlay = (tab: Table, code: string): boolean => playableCards(tab.state, tab).includes(idsOf(tab, code));

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([STALLION, BILL, RALLYING_CRY, KNIFE_WORK, ELROND, ATHELAS, SHADOW, GIMLI, GRIM_RESOLVE, NORTHERN_TRACKER, WE_DO_NOT_SLEEP, CAPTAINS, MEN_OF_THE_WEST, HUNTER, EXPLORER, WARDEN, CEORL, MENDOR, OUTMATCHED, SWIFT_AND_SILENT, DETERMINATION, GANDALF, ARAGORN_LORE, ARAGORN, BERAVOR, ELEANOR, DUNHERE]))]) };
  base.cards.set(CONDITION, definePrinted({ code: CONDITION, name: "Condition", type: "attachment", sphere: "neutral", cost: 0, traits: ["Condition"] }));
  base.cards.set(NOBLE, definePrinted({ code: NOBLE, name: "Noble", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 3, traits: ["Noble"] }));
});

describe("Grim Resolve 01025:A:1 with every character ready", () => {
  // "Action: Ready all character cards in play."
  const grim = (): Table => table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: GRIM_RESOLVE, seat: 0 }] });

  it("is not offered while no character is exhausted", () => {
    expect(offeredPlay(grim(), GRIM_RESOLVE)).toBe(false);
  });

  it("is offered once a character is exhausted", () => {
    expect(offeredPlay(exhaust(grim(), BERAVOR), GRIM_RESOLVE)).toBe(true);
  });
});

describe("We Do Not Sleep 02101:A:1 and Captains of the West 146010:A:1 with no character to hold the lasting effect", () => {
  // "Action: Until the end of the phase, Rohan characters do not exhaust to commit to quests."
  const sleepless = (heroes: readonly string[]): Table => table({ heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: WE_DO_NOT_SLEEP, seat: 0 }] });

  it("We Do Not Sleep is not offered with no Rohan character in play", () => {
    expect(offeredPlay(sleepless([ELEANOR]), WE_DO_NOT_SLEEP)).toBe(false);
  });

  it("We Do Not Sleep is offered with a Rohan character in play", () => {
    expect(offeredPlay(sleepless([ELEANOR, DUNHERE]), WE_DO_NOT_SLEEP)).toBe(true);
  });

  // "Quest Action: Until the end of the phase, each Noble hero gets +1 Willpower and does not exhaust to commit to the quest."
  const captains = (heroes: readonly string[]): Table => table({ start: "quest", heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: CAPTAINS, seat: 0 }] });

  it("Captains of the West is not offered with no Noble hero in play", () => {
    expect(offeredPlay(captains([PAL]), CAPTAINS)).toBe(false);
  });

  it("Captains of the West is offered with a Noble hero in play", () => {
    expect(offeredPlay(captains([PAL, NOBLE]), CAPTAINS)).toBe(true);
  });
});

describe("Men of the West 06083:A:1 with no Outlands ally in the discard pile", () => {
  // "Action: Return X Outlands allies from your discard pile to your hand."
  function men(inDiscard: boolean): Table {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: MEN_OF_THE_WEST, seat: 0 }] });
    return inDiscard ? { ...tab, state: spawn(tab.state, HUNTER, { zone: "discard", seat: 0 }).state } : tab;
  }

  it("is not offered with none", () => {
    expect(offeredPlay(men(false), MEN_OF_THE_WEST)).toBe(false);
  });

  it("is offered with one", () => {
    expect(offeredPlay(men(true), MEN_OF_THE_WEST)).toBe(true);
  });
});

describe("Mirkwood Explorer 12037:A:2 holding no progress", () => {
  // "Action: Exhaust Mirkwood Explorer to move all progress from it to a location in play."
  function explorer(progress: number): Table {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: EXPLORER, seat: 0 }], staging: [FORD] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, EXPLORER), { progress }) };
  }

  it("is not offered with no progress on it, so the exhaust is not paid for nothing", () => {
    expect(triggers(explorer(0).state, explorer(0))).not.toContain("12037:action:1");
  });

  it("is offered with progress on it and a location in play", () => {
    expect(triggers(explorer(2).state, explorer(2))).toContain("12037:action:1");
  });
});

describe("Warden of Healing 04083:A:1 with no damaged character", () => {
  // "Action: Exhaust Warden of Healing to heal 1 damage on up to 2 different characters."
  function warden(damage: number): Table {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: WARDEN, seat: 0 }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, ARAGORN), { damage }) };
  }

  it("is not offered with no damage anywhere", () => {
    expect(triggers(warden(0).state, warden(0))).not.toContain("04083:action:1");
  });

  it("is offered once a character has damage", () => {
    expect(triggers(warden(1).state, warden(1))).toContain("04083:action:1");
  });
});

describe("Aragorn 04053:A:2 at his starting threat level", () => {
  // "Refresh Action: Reduce your threat to your starting threat level. (Limit once per game.)"
  const refresh = (threat: number): Table => {
    const tab = table({ heroes: [{ code: ARAGORN_LORE, seat: 0 }] });
    const run = enter(withThreat(tab.state, 0, threat), tab, "refresh");
    return { ...tab, state: run.state };
  };

  it("is not offered when the threat is already at or below the starting threat level", () => {
    expect(triggers(refresh(5).state, refresh(5))).not.toContain("04053:action:1");
  });

  it("is offered when the threat is above the starting threat level", () => {
    expect(triggers(refresh(30).state, refresh(30))).toContain("04053:action:1");
  });
});

describe("Northern Tracker 01045:A:1 with no location in the staging area", () => {
  // "Response: After Northern Tracker commits to a quest, place 1 progress token on each location in the staging area."
  function committed(staging: readonly string[]): boolean {
    const tab = table({ start: "quest", heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: NORTHERN_TRACKER, seat: 0 }], staging });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, NORTHERN_TRACKER)] }, tab.ctx);
    return triggers(run.state, tab).includes("01045:response:1");
  }

  it("is not offered with only an enemy in the staging area", () => {
    expect(committed([RIDER])).toBe(false);
  });

  it("is offered with a location in the staging area", () => {
    expect(committed([RIDER, FORD])).toBe(true);
  });
});

describe("Knife-work 12114:A:1 with no enemy engaged and no Lore resources to spend", () => {
  // "Action: Choose a player. Each enemy engaged with that player gets -1 Defense until the end of the phase. Then, the players as a group may spend 2 Lore resources to have the chosen player draw 1 card each time he attacks and destroys an enemy this phase."
  const knife = (engaged: boolean): Table => table({ heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: KNIFE_WORK, seat: 0 }], ...(engaged ? { engaged: [{ code: FOE, seat: 0 }] } : {}) });

  it("is not offered with no enemy to weaken and no Lore hero to pay the 2 resources", () => {
    expect(offeredPlay(knife(false), KNIFE_WORK)).toBe(false);
  });

  it("is offered with an enemy engaged with a player", () => {
    expect(offeredPlay(knife(true), KNIFE_WORK)).toBe(true);
  });
});

describe("Message from Elrond 08032:A:1 with no other player", () => {
  // "Action: Choose a player. That player may choose 1 card from his hand and add it to another player's hand."
  const message = (seats: 1 | 2): Table =>
    table({ seats, heroes: [{ code: BERAVOR, seat: 0 }, ...(seats === 2 ? [{ code: PAL, seat: 1 }] : [])], hand: [{ code: ELROND, seat: 0 }, { code: MEN_OF_THE_WEST, seat: 0 }] });

  it("is not offered to a player with no other player in the game", () => {
    expect(offeredPlay(message(1), ELROND)).toBe(false);
  });

  it("is offered when there is another player to give a card to", () => {
    expect(offeredPlay(message(2), ELROND)).toBe(true);
  });
});

describe("Athelas 09011:A:2 with nothing to heal or discard", () => {
  // "Action: Discard Athelas and exhaust attached character to heal all damage on a character. You may discard a Condition attachment from that character."
  const athelas = (damage: number): Table => {
    const tab = table({ heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: ATHELAS, host: BERAVOR }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, BERAVOR), { damage }) };
  };

  it("is not offered with no damage on any character and no Condition attachment to discard", () => {
    expect(triggers(athelas(0).state, athelas(0))).not.toContain("09011:action:1");
  });

  it("is offered once a character has damage", () => {
    expect(triggers(athelas(2).state, athelas(2))).toContain("09011:action:1");
  });

  it("is offered for a character with no damage that carries a Condition attachment it may discard", () => {
    const tab = table({ heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: ATHELAS, host: BERAVOR }, { code: CONDITION, host: BERAVOR }] });
    expect(triggers(tab.state, tab)).toContain("09011:action:1");
    // The same table with the attachment of another trait is refused again.
    const plain = table({ heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: ATHELAS, host: BERAVOR }] });
    expect(triggers(plain.state, plain)).not.toContain("09011:action:1");
  });
});

describe("Shadow of the Past 02125:A:1 with an empty encounter discard pile", () => {
  // "Action: Move the top card of the encounter discard pile to the top of the encounter deck."
  const shadow = (discard: readonly string[]): Table => table({ heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: SHADOW, seat: 0 }], discard });

  it("is not offered with no card in the encounter discard pile", () => {
    expect(offeredPlay(shadow([]), SHADOW)).toBe(false);
  });

  it("is offered with a card in the encounter discard pile", () => {
    expect(offeredPlay(shadow([FOE]), SHADOW)).toBe(true);
  });
});

describe("Rallying Cry 10003:A:1 for an ally that did not go to the discard pile", () => {
  // "Response: After an ally leaves play, add it to its owner's hand instead of placing it in the discard pile."
  function left(to: "discard" | "hand"): { tab: Table; state: ReturnType<typeof settle> } {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: HELPER, seat: 0 }], hand: [{ code: RALLYING_CRY, seat: 0 }] });
    const ally = idsOf(tab, HELPER);
    const gone = { ...moveCard(tab.state, ally, { zone: to, seat: 0 }), window: null, pendingEvents: [{ trigger: "allyLeftPlay" as const, seat: 0, cardId: ally }] };
    return { tab, state: settle(gone, tab.ctx, []) };
  }

  it("is offered for an ally in the discard pile", () => {
    const { tab, state } = left("discard");
    expect(triggers(state, tab)).toContain("10003:response:1");
  });

  it("is not offered for an ally that already went to its owner's hand", () => {
    const { tab, state } = left("hand");
    expect(triggers(state, tab)).not.toContain("10003:response:1");
  });
});

describe("Wild Stallion 19033:A:2 with only an ally that cannot have attachments", () => {
  // "Planning Action: Attach Wild Stallion to an ally you control. (Counts as a Mount attachment with the text: "Restricted. Limit 1 per ally. ...")" Bill the Pony: "Cannot have attachments."
  const stallion = (other: string): Table => table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: STALLION, seat: 0 }, { code: other, seat: 0 }] });

  it("is not offered when the only other ally is Bill the Pony", () => {
    expect(triggers(stallion(BILL).state, stallion(BILL))).not.toContain("19033:action:1");
  });

  it("is offered when another ally can take it", () => {
    expect(triggers(stallion(HELPER).state, stallion(HELPER))).toContain("19033:action:1");
  });
});

describe("Ceorl 12058:A:1 while he is ready", () => {
  // "Spend 1 Spirit resource to ready Ceorl. Then, you may give control of Ceorl to another player." The part after "Then" resolves only if the ready did (rr.then), so a ready Ceorl is not offered.
  const ceorl = (exhausted: boolean): Table => {
    const tab = table({ heroes: [{ code: ELEANOR, seat: 0 }], allies: [{ code: CEORL, seat: 0 }] });
    return exhausted ? exhaust(tab, CEORL) : tab;
  };

  it("is not offered while Ceorl is ready", () => {
    expect(triggers(ceorl(false).state, ceorl(false))).not.toContain("12058:action:1");
  });

  it("is offered once Ceorl is exhausted", () => {
    expect(triggers(ceorl(true).state, ceorl(true))).toContain("12058:action:1");
  });

  it("is not offered while Ceorl is exhausted and cannot ready: the ready would not happen", () => {
    const tab = ceorl(true);
    const id = idsOf(tab, CEORL);
    const state = { ...tab.state, modifiers: [...tab.state.modifiers, { instanceId: id, sourceId: id, stat: "cannotReady" as const, amount: 1, until: "endOfRound" as const }] };
    expect(triggers(state, tab)).not.toContain("12058:action:1");
  });

  it("readies Ceorl when it is used", () => {
    const tab = ceorl(true);
    const id = idsOf(tab, CEORL);
    const done = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: id, effectId: "12058:action:1", payments: [{ heroId: idsOf(tab, ELEANOR), amount: 1 }] }, tab.ctx);
    expect(done.state.cards[id]?.exhausted).toBe(false);
  });
});

describe("Mendor 01135:A:3 and the ready before Then", () => {
  // "Response: After a quest card is defeated, ready Mendor. Then, each player draws 1 card." The draw resolves only if the ready did (rr.then). Mendor is an objective ally a player controls, read like
  // a player card for rr.triggered-ability: with no ready that can happen the Response changes nothing and is not offered.
  function defeated(exhausted: boolean, barred = false): { tab: Table; state: ReturnType<typeof settle> } {
    const base = table({ heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: MENDOR, seat: 0 }], playerDeck: [{ code: GIMLI, seat: 0 }, { code: GIMLI, seat: 0 }] });
    const exhaustedMendor = exhausted ? exhaust(base, MENDOR) : base;
    const id = idsOf(base, MENDOR);
    const tab = barred ? { ...exhaustedMendor, state: { ...exhaustedMendor.state, modifiers: [...exhaustedMendor.state.modifiers, { instanceId: id, sourceId: id, stat: "cannotReady" as const, amount: 1, until: "endOfRound" as const }] } } : exhaustedMendor;
    const event = { ...tab.state, window: null, pendingEvents: [{ trigger: "questCardDefeated" as const, seat: 0, cardId: id }] };
    return { tab, state: settle(event, tab.ctx, []) };
  }

  it("is not offered while Mendor is ready", () => {
    const { tab, state } = defeated(false);
    expect(triggers(state, tab)).not.toContain("01135:response:1");
  });

  it("is not offered while Mendor is exhausted and cannot ready: the ready would not happen and nobody draws", () => {
    const { tab, state } = defeated(true, true);
    expect(triggers(state, tab)).not.toContain("01135:response:1");
  });

  it("readies Mendor and each player draws 1 card when he is exhausted", () => {
    const { tab, state } = defeated(true);
    expect(triggers(state, tab)).toContain("01135:response:1");
    const hand = (current: typeof state) => current.seats[0]?.hand.length ?? 0;
    const done = sendUnledgered({ state, steps: [] }, { type: "Trigger", cardId: idsOf(tab, MENDOR), effectId: "01135:response:1" }, tab.ctx);
    expect(done.state.cards[idsOf(tab, MENDOR)]?.exhausted).toBe(false);
    expect(hand(done.state)).toBe(hand(state) + 1);
  });
});

describe("Outmatched 19062:A:3 when the defending character is ready", () => {
  // "Response: After attached enemy resolves its attack, ready the defending character." The attack resolved with the defender (Aragorn) as the event's other card.
  function resolved(defenderExhausted: boolean, defended = true): { tab: Table; state: ReturnType<typeof settle> } {
    const loose = table({ heroes: [{ code: ARAGORN, seat: 0 }], engaged: [{ code: FOE, seat: 0 }], allies: [{ code: OUTMATCHED, seat: 0 }] });
    const base = { ...loose, state: attachTo(loose.state, idsOf(loose, OUTMATCHED), idsOf(loose, FOE)) };
    const tab = defenderExhausted ? exhaust(base, ARAGORN) : base;
    const event = { ...tab.state, window: null, pendingEvents: [{ trigger: "attackResolved" as const, seat: 0, cardId: idsOf(tab, FOE), ...(defended ? { other: idsOf(tab, ARAGORN) } : {}) }] };
    return { tab, state: settle(event, tab.ctx, []) };
  }

  it("is not offered while the defending character is ready", () => {
    const { tab, state } = resolved(false);
    expect(triggers(state, tab)).not.toContain("19062:response:1");
  });

  it("is offered once the defending character is exhausted", () => {
    const { tab, state } = resolved(true);
    expect(triggers(state, tab)).toContain("19062:response:1");
  });

  it("is not offered after an undefended attack: there is no defending character to ready", () => {
    const { tab, state } = resolved(true, false);
    expect(triggers(state, tab)).not.toContain("19062:response:1");
  });
});

describe("Swift and Silent 08003:A:1 with every hero ready", () => {
  // "Action: Ready a hero you control. Then, if your threat is 20 or less and this is the first time you played a copy of Swift and Silent this round, return this card to your hand instead of discarding it."
  const swift = (exhaustedHeroes: readonly string[]): Table => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: SWIFT_AND_SILENT, seat: 0 }] });
    return exhaustedHeroes.reduce(exhaust, tab);
  };
  // The card is played and the hero `chosen` is the one to ready; where the event ends up.
  const played = (tab: Table, chosen: string): string => {
    const asked = play(begin(tab.state), tab, idsOf(tab, SWIFT_AND_SILENT));
    const done = sendUnledgered(asked, { type: "Choose", optionId: idsOf(tab, chosen) }, tab.ctx);
    return done.state.cards[idsOf(tab, SWIFT_AND_SILENT)]?.zone ?? "";
  };

  it("is not offered while every hero is ready: the ready changes nothing and the return waits for it (rr.then)", () => {
    expect(offeredPlay(swift([]), SWIFT_AND_SILENT)).toBe(false);
  });

  it("is offered once a hero is exhausted", () => {
    expect(offeredPlay(swift([BERAVOR]), SWIFT_AND_SILENT)).toBe(true);
  });

  it("returns to the hand when it readies an exhausted hero, and is discarded when the hero chosen was ready already", () => {
    const tab = swift([BERAVOR]);
    expect(played(tab, BERAVOR)).toBe("hand");
    expect(played(tab, ARAGORN)).toBe("discard");
  });
});

describe("Swift and Silent 08003:A:1 on a hero that cannot ready", () => {
  // "Your cards cannot ready for the remainder of the round" (Ungoliant's Brood 900103:A:1): the ready does not happen, so the part after "Then" is not attempted (rr.then).
  const barredHero = (): { tab: Table; barred: string } => {
    const tab = exhaust(exhaust(table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: SWIFT_AND_SILENT, seat: 0 }] }), ARAGORN), BERAVOR);
    const hero = idsOf(tab, BERAVOR);
    const state = { ...tab.state, modifiers: [...tab.state.modifiers, { instanceId: hero, sourceId: hero, stat: "cannotReady" as const, amount: 1, until: "endOfRound" as const }] };
    return { tab: { ...tab, state }, barred: hero };
  };

  it("is discarded, not returned to the hand, when the hero chosen cannot ready", () => {
    const { tab, barred } = barredHero();
    const asked = play(begin(tab.state), tab, idsOf(tab, SWIFT_AND_SILENT));
    const done = sendUnledgered(asked, { type: "Choose", optionId: barred }, tab.ctx);
    expect(done.state.cards[barred]?.exhausted).toBe(true);
    expect(done.state.cards[idsOf(tab, SWIFT_AND_SILENT)]?.zone).toBe("discard");
  });

  it("is not offered when every hero is exhausted and barred from readying", () => {
    const { tab } = barredHero();
    const other = idsOf(tab, ARAGORN);
    const state = { ...tab.state, modifiers: [...tab.state.modifiers, { instanceId: other, sourceId: other, stat: "cannotReady" as const, amount: 1, until: "endOfRound" as const }] };
    expect(offeredPlay({ ...tab, state }, SWIFT_AND_SILENT)).toBe(false);
  });
});

describe("Determination 10172:A:1 once it is attached", () => {
  // "Action: Attach Determination to a unique character. Then, ready each character with a copy of Determination attached, ..." The Action plays the event from the hand: attached, the card is a Condition attachment and
  // using its Action again would only discard it (the event's cost), with nothing readied.
  const determined = (attachedTo: string | null): Table => {
    const tab = table({ heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], ...(attachedTo ? { allies: [{ code: DETERMINATION, seat: 0 }] } : { hand: [{ code: DETERMINATION, seat: 0 }] }) });
    return attachedTo ? { ...tab, state: attachTo(tab.state, idsOf(tab, DETERMINATION), idsOf(tab, attachedTo)) } : tab;
  };

  it("is not offered from the character it is attached to", () => {
    expect(triggers(determined(ARAGORN).state, determined(ARAGORN))).not.toContain("10172:action:1");
  });

  it("is offered as the event in the hand when a unique character can carry it", () => {
    expect(offeredPlay(determined(null), DETERMINATION)).toBe(true);
  });

  it("is offered as the event on the top of the deck while Gandalf lets it be played from there (142002:A:1)", () => {
    const tab = table({ heroes: [{ code: GANDALF, seat: 0 }, { code: ARAGORN, seat: 0 }], playerDeck: [{ code: DETERMINATION, seat: 0 }] });
    expect(tab.state.cards[idsOf(tab, DETERMINATION)]?.zone).toBe("deck");
    expect(offeredPlay(tab, DETERMINATION)).toBe(true);
  });
});

// Rules: rr.response, rr.action, rr.cost, rr.printed, rr.attachment-cards, rr.play-restrictions-and-permissions, rr.engaged,
// rr.engagement-check, rr.optional-engagement, rr.ranged, rr.cancel, rr.damage, rr.staging, rr.lasting-effects, rr.triggered-ability
// (data/rules/entries.json).
// The Encounter at Amon Dîn player cards, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Pippin
// 06056:A:1, Lord of Morthond 06058:A:1 and A:2, Book of Eldacar 06059:A:1 and A:2, Gondorian Discipline 06060:A:1, Ithilien Archer
// 06063:A:2, Ithilien Pit 06064:A:1 to A:3, Hobbit-sense 06065:A:1 and A:2. The lines are the text of data/cards/EaAD.json (data/printed
// holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { playCost } from "../../rules/player/attach.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, combat, endRound, enter, fillers, hosts, passAll, play, playerTable, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const PIPPIN = "06056";
const MORTHOND = "06058";
const BOOK = "06059";
const DISCIPLINE = "06060";
const ARCHER = "06063";
const PIT = "06064";
const SENSE = "06065";
// Song of Travel (The Hills of Emyn Muil): "Attached hero gains a Spirit resource icon."
const SONG = "02081";
// The Fellowship Aragorn and Roheryn (The Flame of the West): with Roheryn, Aragorn gains a Tactics icon that is not printed.
const FELLOWSHIP = "145001";
const ROHERYN = "145012";
// Core Aragorn (Leadership, not Gondor), Gimli and Legolas (Tactics), Denethor (Lore, Gondor), Gondorian Spearman (Tactics ally).
const ARAGORN = "01001";
const GIMLI = "01004";
const LEGOLAS = "01005";
const DENETHOR = "01010";
const SPEARMAN = "01029";
// Heroes with no text: a Leadership Gondor one, a Leadership Outlands one, a Tactics Gondor one; the Pal (scene.ts) is a Leadership Hobbit.
const LORD = "lord";
const OUTLANDER = "outlander";
const CAPTAIN = "captain";
const PAL = "pal";
const ALLY = "ally";
// A Spirit ally and a Leadership ally with no text, cost 1.
const SPIRIT_ALLY = "spirit-ally";
// Enemies: the Brute attacks for 4; the Soft has Defense 0, the Hard Defense 9; the Near engages at threat 5. None is destroyed here.
const BRUTE = "brute";
const SOFT = "soft";
const HARD = "hard";
const NEAR = "near";
const FIELD = "field";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [PIPPIN, MORTHOND, BOOK, DISCIPLINE, ARCHER, PIT, SENSE, SONG, FELLOWSHIP, ROHERYN, ARAGORN, GIMLI, LEGOLAS, DENETHOR, SPEARMAN];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(LORD, definePrinted({ code: LORD, name: "Lord", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Gondor"] }));
  cards.set(OUTLANDER, definePrinted({ code: OUTLANDER, name: "Outlander", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Outlands"] }));
  cards.set(CAPTAIN, definePrinted({ code: CAPTAIN, name: "Captain", type: "hero", sphere: "tactics", threat: 9, willpower: 1, attack: 1, defense: 1, health: 9, traits: ["Gondor"] }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 4, defense: 1, health: 9 }));
  cards.set(SOFT, definePrinted({ code: SOFT, name: "Soft", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(HARD, definePrinted({ code: HARD, name: "Hard", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 9 }));
  cards.set(NEAR, definePrinted({ code: NEAR, name: "Near", type: "enemy", threat: 1, engagementCost: 5, attack: 1, defense: 1, health: 9 }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", threat: 1, questPoints: 3 }));
  base = { ...starter, cards };
});

const playable = (state: ScenarioState, tab: Table, id: string): boolean => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);

describe("Pippin (06056:A:1)", () => {
  // The encounter phase opens on the optional engagement with the Near (cost 5) in the staging area; the player engages it.
  function engaged(effects: readonly Effect[], other: string): { tab: Table; run: Run } {
    const tab = table(effects, { start: "encounter", heroes: [{ code: PIPPIN, seat: 0 }, { code: other, seat: 0 }], staging: [NEAR], engaged: [{ code: HARD, seat: 0 }] });
    return { tab, run: sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, NEAR) }, tab.ctx) };
  }

  // "If each hero you control has the Hobbit trait, Pippin gains: "Response: After an enemy engages you, raise your threat by 3 to return it
  // to the staging area. Until the end of the round, that enemy cannot engage you."": Pippin and the Pal (Hobbits); the threat goes from 8
  // to 11, the Near goes back to the staging area and this round's engagement check leaves it there; the next round's engages it.
  lineSpec("06056:A:1", "Pippin: with Hobbit heroes only, raise your threat by 3 to return an enemy that engages you to the staging area", (effects) => {
    const { tab, run: engagedRun } = engaged(effects, PAL);
    const near = idsOf(tab, NEAR);
    expect(engagedRun.state.cards[near]?.zone).toBe("engaged");
    expect(triggers(engagedRun.state, tab)).toContain("06056:response:1");
    let run = sendUnledgered(engagedRun, { type: "Trigger", cardId: idsOf(tab, PIPPIN), effectId: "06056:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 + 3);
    expect(run.state.cards[near]?.zone).toBe("staging");
    run = passAll(run, tab.ctx, { engage: true });
    // The game is at the Hard's attack (the combat phase): the engagement check is over and the Near is still in the staging area.
    expect(run.state.phase).toBe("Combat");
    expect(run.state.cards[near]?.zone).toBe("staging");
    const later = enter(endRound(run.state, tab).state, tab, "engagement");
    expect(later.state.cards[near]?.zone).toBe("engaged");
  });

  // Aragorn is not a Hobbit: Pippin does not gain the Response.
  it("06056:A:1 Pippin: no Response while a hero you control is not a Hobbit", () => {
    const { tab, run } = engaged(EFFECTS, ARAGORN);
    expect(run.state.cards[idsOf(tab, NEAR)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("06056:response:1");
  });
});

describe("Lord of Morthond (06058:A:1, A:2)", () => {
  // "Attach to a Gondor or Outlands hero.": the Lord (Gondor) and the Outlander are offered; Aragorn (not Gondor) and the Spearman (a Gondor
  // ally) are not.
  lineSpec("06058:A:1", "Lord of Morthond: attach to a Gondor or Outlands hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LORD, seat: 0 }, { code: OUTLANDER, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: MORTHOND, seat: 0 }] });
    const morthond = idsOf(tab, MORTHOND);
    expect(hosts(tab, morthond)).toEqual([idsOf(tab, LORD), idsOf(tab, OUTLANDER)].sort());
    expect(play(begin(tab.state), tab, morthond, idsOf(tab, OUTLANDER)).state.cards[morthond]?.host).toBe(idsOf(tab, OUTLANDER));
  });

  // The Lord holds Lord of Morthond and Song of Travel (a Spirit icon, so he pays for the Spirit ally); `others` are the other heroes.
  const morthond = (effects: readonly Effect[], others: readonly string[]): Table =>
    table(effects, { heroes: [{ code: LORD, seat: 0 }, ...others.map((code) => ({ code, seat: 0 }))], attached: [{ code: MORTHOND, host: LORD }, { code: SONG, host: LORD }], hand: [{ code: SPIRIT_ALLY, seat: 0 }, { code: ALLY, seat: 0 }], playerDeck: fillers(ALLY, 3) });

  // "If each hero you control has a printed Leadership resource icon, Lord of Morthond gains: "Response: After you play a Lore, Spirit, or
  // Tactics ally, draw 1 card."": the Lord and Aragorn (printed Leadership); the Spirit ally is played and a card is drawn.
  lineSpec("06058:A:2", "Lord of Morthond: with printed Leadership heroes only, draw 1 card after you play a Spirit ally", (effects) => {
    const tab = morthond(effects, [ARAGORN]);
    let run = play(begin(tab.state), tab, idsOf(tab, SPIRIT_ALLY));
    expect(run.state.cards[idsOf(tab, SPIRIT_ALLY)]?.zone).toBe("play");
    const hand = run.state.seats[0]?.hand.length ?? 0;
    expect(triggers(run.state, tab)).toContain("06058:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, MORTHOND), effectId: "06058:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(hand + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // A Leadership ally is not a Lore, Spirit or Tactics ally: no Response.
  it("06058:A:2 Lord of Morthond: no Response after a Leadership ally is played", () => {
    const tab = morthond(EFFECTS, [ARAGORN]);
    const ally = tab.ids[ALLY]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    const run = play(begin(tab.state), tab, ally);
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("06058:response:1");
  });

  // Denethor has a printed Lore icon: Lord of Morthond does not gain the Response.
  it("06058:A:2 Lord of Morthond: no Response while a hero you control has no printed Leadership icon", () => {
    const tab = morthond(EFFECTS, [DENETHOR]);
    const run = play(begin(tab.state), tab, idsOf(tab, SPIRIT_ALLY));
    expect(run.state.cards[idsOf(tab, SPIRIT_ALLY)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("06058:response:1");
  });
});

describe("Book of Eldacar (06059:A:1, A:2)", () => {
  // "Attach to a Tactics hero.": Gimli and Legolas are offered; Aragorn (Leadership) and the Spearman (a Tactics ally) are not.
  lineSpec("06059:A:1", "Book of Eldacar: attach to a Tactics hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: BOOK, seat: 0 }] });
    const book = idsOf(tab, BOOK);
    expect(hosts(tab, book)).toEqual([idsOf(tab, GIMLI), idsOf(tab, LEGOLAS)].sort());
    expect(play(begin(tab.state), tab, book, idsOf(tab, LEGOLAS)).state.cards[book]?.host).toBe(idsOf(tab, LEGOLAS));
  });

  // "Reduce the cost to play Book of Eldacar by 1 for each hero you control with a printed Tactics resource icon.": Gimli and Legolas make
  // it 4 - 2; Gimli and Aragorn 4 - 1. Played with Gimli and Legolas, Gimli pays 2.
  lineSpec("06059:A:2", "Book of Eldacar: costs 1 less for each hero you control with a printed Tactics icon", (effects) => {
    const two = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: BOOK, seat: 0 }] });
    const one = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: BOOK, seat: 0 }] });
    expect(playCost(one.state, idsOf(one, BOOK), 0, one.ctx)).toBe(4 - 1);
    expect(playCost(two.state, idsOf(two, BOOK), 0, two.ctx)).toBe(4 - 2);
    const gimli = idsOf(two, GIMLI);
    const run = sendUnledgered(begin(two.state), { type: "PlayCard", cardId: idsOf(two, BOOK), hostId: gimli, payments: [{ heroId: gimli, amount: 2 }] }, two.ctx);
    expect(run.state.cards[idsOf(two, BOOK)]?.host).toBe(gimli);
    expect(run.state.cards[gimli]?.resources).toBe(6 - 2);
  });

  // "you control" and "printed": the other player's Legolas, and the Fellowship Aragorn's Tactics icon from Roheryn, are not counted.
  it("06059:A:2 Book of Eldacar: another player's hero and an icon that is not printed are not counted", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: FELLOWSHIP, seat: 0 }, { code: LEGOLAS, seat: 1 }], attached: [{ code: ROHERYN, host: FELLOWSHIP }], hand: [{ code: BOOK, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, BOOK), 0, tab.ctx)).toBe(4 - 1);
  });
});

describe("Gondorian Discipline (06060:A:1)", () => {
  // `defender` defends the Brute's attack (4 against Defense 1): 3 damage is dealt to him. Gondorian Discipline is in hand.
  function defended(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: defender, seat: 0 }], hand: [{ code: DISCIPLINE, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx);
    return { tab, run: passAll(run, tab.ctx) };
  }

  // "Response: Cancel up to 2 points of damage just dealt to a Gondor character.": the Captain (Gondor) keeps 1 of the 3.
  lineSpec("06060:A:1", "Gondorian Discipline: cancel up to 2 damage just dealt to a Gondor character", (effects) => {
    const { tab, run: dealt } = defended(effects, CAPTAIN);
    const [captain, discipline] = [idsOf(tab, CAPTAIN), idsOf(tab, DISCIPLINE)];
    expect(triggers(dealt.state, tab)).toContain("06060:response:1");
    const run = passAll(sendUnledgered(dealt, { type: "Trigger", cardId: discipline, effectId: "06060:response:1", payments: payFor(dealt.state, tab.ctx, discipline) }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[captain]?.damage).toBe(3 - 2);
    expect(run.state.cards[discipline]?.zone).toBe("discard");
  });

  // Gimli is not Gondor: no Response, and he keeps the 3 damage.
  it("06060:A:1 Gondorian Discipline: not offered for a character that is not Gondor", () => {
    const { tab, run } = defended(EFFECTS, GIMLI);
    expect(run.state.cards[idsOf(tab, GIMLI)]?.damage).toBe(4 - 2);
    expect(triggers(run.state, tab)).not.toContain("06060:response:1");
  });
});

describe("Ithilien Archer (06063:A:2)", () => {
  // The Archer attacks `enemy`, engaged with `seat` (the other player's, a ranged attack, when 1).
  function attacked(effects: readonly Effect[], enemy: string, seat = 0): { tab: Table; run: Run } {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ARCHER, seat: 0 }], engaged: [{ code: enemy, seat }] });
    // The other player may act once the attack is declared: that action window is passed and the attack resolves.
    return { tab, run: passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: [idsOf(tab, ARCHER)] }, tab.ctx), tab.ctx) };
  }

  // "Response: After Ithilien Archer attacks and damages an enemy, return that enemy to the staging area.": the Soft (Defense 0) takes 2
  // and goes back to the staging area; so does the Soft engaged with the other player (a ranged attack).
  lineSpec("06063:A:2", "Ithilien Archer: after he attacks and damages an enemy, return it to the staging area", (effects) => {
    for (const seat of [0, 1]) {
      const { tab, run: hit } = attacked(effects, SOFT, seat);
      const soft = idsOf(tab, SOFT);
      expect(hit.state.cards[soft]?.damage).toBe(2);
      expect(triggers(hit.state, tab)).toContain("06063:response:1");
      const run = sendUnledgered(hit, { type: "Trigger", cardId: idsOf(tab, ARCHER), effectId: "06063:response:1" }, tab.ctx);
      expect(run.state.cards[soft]?.zone).toBe("staging");
    }
  });

  // The Hard (Defense 9) takes no damage: no Response.
  it("06063:A:2 Ithilien Archer: not offered after an attack that deals no damage", () => {
    const { tab, run } = attacked(EFFECTS, HARD);
    expect(run.state.cards[idsOf(tab, HARD)]?.damage ?? 0).toBe(0);
    expect(triggers(run.state, tab)).not.toContain("06063:response:1");
  });
});

describe("Ithilien Pit (06064:A:1, A:2, A:3)", () => {
  // "Play Ithilien Pit into the staging area unattached.": its only place is the staging area, and it is there with no host.
  lineSpec("06064:A:1", "Ithilien Pit: played into the staging area unattached", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], engaged: [{ code: SOFT, seat: 0 }], hand: [{ code: PIT, seat: 0 }] });
    const pit = idsOf(tab, PIT);
    expect(hosts(tab, pit)).toEqual(["staging"]);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: pit, hostId: "staging", payments: payFor(tab.state, tab.ctx, pit) }, tab.ctx);
    expect(run.state.cards[pit]?.zone).toBe("staging");
    expect(run.state.cards[pit]?.host ?? null).toBeNull();
  });

  // The Pit is in the staging area unattached; the quest phase's staging step reveals `revealed`.
  function staged(effects: readonly Effect[], deck: readonly string[]): { tab: Table; run: Run } {
    const scene = table(effects, { start: "quest", heroes: [{ code: PAL, seat: 0 }], staging: [PIT], deck });
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, PIT), { controller: 0, owner: 0 }) };
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    return { tab, run: passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true }) };
  }

  // "If unattached, attach Ithilien Pit to the next eligible enemy that enters the staging area.": the revealed Soft has the Pit attached.
  lineSpec("06064:A:2", "Ithilien Pit: attaches to the next enemy that enters the staging area", (effects) => {
    const { tab, run } = staged(effects, [SOFT]);
    expect(run.state.cards[idsOf(tab, SOFT)]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, PIT)]?.host).toBe(idsOf(tab, SOFT));
  });

  // A location is not an enemy: the Pit stays unattached.
  it("06064:A:2 Ithilien Pit: a location added to the staging area does not take it", () => {
    const { tab, run } = staged(EFFECTS, [FIELD]);
    expect(run.state.cards[idsOf(tab, FIELD)]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, PIT)]?.host ?? null).toBeNull();
  });

  // "Any character may choose attached enemy as the target of an attack.": the Soft with the Pit is engaged with the other player; Denethor
  // (not ranged) may attack it. Without the Pit the same attack is refused.
  lineSpec("06064:A:3", "Ithilien Pit: any character may attack the attached enemy", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: SOFT, seat: 1 }, { code: HARD, seat: 1 }], staging: [PIT] });
    const [soft, hard, denethor] = [idsOf(tab, SOFT), idsOf(tab, HARD), idsOf(tab, DENETHOR)];
    const pitted = attach({ ...tab, state: updateCard(tab.state, idsOf(tab, PIT), { controller: 0, owner: 0 }) }, [[idsOf(tab, PIT), soft]]);
    expect(pitted.state.cards[idsOf(tab, PIT)]?.host).toBe(soft);
    const state = attacking(pitted.state);
    expect(refusal(state, { type: "DeclareAttackers", enemyId: hard, attackerIds: [denethor] }, tab.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(state), { type: "DeclareAttackers", enemyId: soft, attackerIds: [denethor] }, tab.ctx);
    expect(run.state.cards[denethor]?.exhausted).toBe(true);
    expect(run.state.cards[soft]?.damage).toBe(1);
  });
});

describe("Hobbit-sense (06065:A:1, A:2)", () => {
  const sense = (effects: readonly Effect[], heroes: readonly string[]): Table =>
    table(effects, { heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: SENSE, seat: 0 }], engaged: [{ code: SOFT, seat: 0 }] });

  // "Play only if each of your heroes is a Hobbit.": with Pippin and the Pal it may be played in the combat action window; with Pippin and
  // Aragorn it may not.
  lineSpec("06065:A:1", "Hobbit-sense: played only if each of your heroes is a Hobbit", (effects) => {
    const hobbits = sense(effects, [PIPPIN, PAL]);
    expect(playable(combat(hobbits.state, hobbits).state, hobbits, idsOf(hobbits, SENSE))).toBe(true);
    const mixed = sense(effects, [PIPPIN, ARAGORN]);
    expect(refusal(combat(mixed.state, mixed).state, { type: "PlayCard", cardId: idsOf(mixed, SENSE), payments: [{ heroId: idsOf(mixed, PIPPIN), amount: 2 }] }, mixed.ctx)).not.toBeNull();
  });

  // "Combat Action: Enemies engaged with you do not attack this round. You cannot declare attacks this round.": played in the combat action
  // window, the Soft makes no attack (the game does not ask for a defender), and Pippin's attack on it is refused.
  lineSpec("06065:A:2", "Hobbit-sense: enemies engaged with you do not attack this round and you cannot declare attacks", (effects) => {
    const tab = sense(effects, [PIPPIN, PAL]);
    const opened = combat(tab.state, tab);
    expect(opened.state.window?.kind).toBe("frameAction");
    const played = play(opened, tab, idsOf(tab, SENSE));
    expect(played.state.cards[idsOf(tab, SENSE)]?.zone).toBe("discard");
    expect(refusal(attacking(played.state), { type: "DeclareAttackers", enemyId: idsOf(tab, SOFT), attackerIds: [idsOf(tab, PIPPIN)] }, tab.ctx)).not.toBeNull();
    // The game runs through the combat phase into the next round with no defense asked for and no enemy strike.
    const run = passAll(played, tab.ctx);
    expect(run.state.round).toBe(tab.state.round + 1);
    expect(run.steps.some((step) => step.kind === "strike" && step.side === "enemy")).toBe(false);
  });

  // "Combat Action": in the planning phase it cannot be played.
  it("06065:A:2 Hobbit-sense: not played outside the combat phase", () => {
    const tab = sense(EFFECTS, [PIPPIN, PAL]);
    expect(playable(tab.state, tab, idsOf(tab, SENSE))).toBe(false);
  });
});

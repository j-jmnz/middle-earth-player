// Rules: rr.response, rr.action, rr.cost, rr.ranged, rr.ready, rr.enters-play, rr.in-play-and-out-of-play, rr.restricted,
// rr.attachment-cards, rr.resource-match, rr.ownership-and-control, rr.quest-phase, rr.lasting-effects, rr.triggered-ability, rr.damage
// (data/rules/entries.json).
// The Hills of Emyn Muil player cards, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Brand
// son of Bain 02072:A:2, Keen-eyed Took 02073:A:2, Rear Guard 02074:A:1, Descendant of Thorondor 02075:A:1 and A:2, Meneldor's Flight
// 02076:A:1, The Riddermark's Finest 02077:A:1, Ride to Ruin 02078:A:1, Song of Travel 02081:A:1 and A:2. The lines are the text of
// data/cards/THoEM.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, canPlay, choices, fillers, hosts, passAll, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const BRAND = "02072";
const TOOK = "02073";
const REAR = "02074";
const DESCENDANT = "02075";
const FLIGHT = "02076";
const FINEST = "02077";
const RUIN = "02078";
const SONG = "02081";
// Core cards: Aragorn (Leadership), Gimli and Legolas (Tactics), Éowyn (Spirit), Snowbourn Scout (a Leadership Rohan ally), Round Shield
// ("Attach to a character. Restricted."), Will of the West (a Spirit event, cost 1).
const ARAGORN = "01001";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const SCOUT = "01016";
const SHIELD = "19118";
const WILL = "01049";
// The Pal (scene.ts): a Leadership hero with no text; the Ally: a Leadership ally with no text.
const PAL = "pal";
const ALLY = "ally";
const CARD = "card";
// An Eagle ally with no text (Tactics), a Spirit ally with no text, a Spirit Rohan ally with no text.
const EAGLE = "eagle";
const SPIRIT_ALLY = "spirit-ally";
const RIDER = "rider";
// Enemies: the Frail dies to any attack; the Wall is never destroyed here.
const FRAIL = "frail";
const WALL = "wall";
const FIELD = "field";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [BRAND, TOOK, REAR, DESCENDANT, FLIGHT, FINEST, RUIN, SONG, ARAGORN, GIMLI, LEGOLAS, EOWYN, SCOUT, SHIELD, WILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(EAGLE, definePrinted({ code: EAGLE, name: "Eagle", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Creature", "Eagle"] }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(RIDER, definePrinted({ code: RIDER, name: "Rider", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Rohan"] }));
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 99 }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", threat: 1, questPoints: 9 }));
  base = { ...starter, cards };
});

describe("Brand son of Bain (02072:A:2)", () => {
  // Two players: Brand for the first, the Pal and an ally (both exhausted) for the second. Brand attacks `enemy`, engaged with `seat`.
  function attacked(effects: readonly Effect[], enemy: string, seat: number): { tab: Table; run: Run } {
    const scene = table(effects, { seats: 2, heroes: [{ code: BRAND, seat: 0 }, { code: PAL, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 1 }, { code: ALLY, seat: 0 }], engaged: [{ code: enemy, seat }] });
    let state = scene.state;
    for (const id of [scene.ids[PAL]?.[0], scene.ids[PAL]?.[1], scene.ids[ALLY]?.[0], scene.ids[ALLY]?.[1]]) state = updateCard(state, id ?? "", { exhausted: true });
    const tab = { ...scene, state };
    return { tab, run: passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: [idsOf(tab, BRAND)] }, tab.ctx), tab.ctx) };
  }

  // "Response: After Brand son of Bain attacks and defeats an enemy engaged with another player, choose and ready one of that player's
  // characters.": Brand (ranged) destroys the Frail engaged with the other player; that player's Pal and ally are offered (Brand's own Pal
  // and ally are not), and the ally chosen is readied.
  lineSpec("02072:A:2", "Brand son of Bain: after he defeats an enemy engaged with another player, ready one of that player's characters", (effects) => {
    const { tab, run: killed } = attacked(effects, FRAIL, 1);
    const [mine = "", theirs = ""] = [tab.ids[PAL]?.[0], tab.ids[PAL]?.[1]];
    const [theirAlly = "", myAlly = ""] = tab.ids[ALLY] ?? [];
    expect(killed.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(triggers(killed.state, tab)).toContain("02072:response:1");
    let run = sendUnledgered(killed, { type: "Trigger", cardId: idsOf(tab, BRAND), effectId: "02072:response:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([theirs, theirAlly].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: theirAlly }, tab.ctx);
    expect(run.state.cards[theirAlly]?.exhausted).toBe(false);
    expect(run.state.cards[theirs]?.exhausted).toBe(true);
    expect(run.state.cards[mine]?.exhausted).toBe(true);
    expect(run.state.cards[myAlly]?.exhausted).toBe(true);
  });

  // The Frail engaged with Brand's own player: no Response.
  it("02072:A:2 Brand son of Bain: not offered after he defeats an enemy engaged with his own player", () => {
    const { tab, run } = attacked(EFFECTS, FRAIL, 0);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("02072:response:1");
  });

  // "defeats": the Wall engaged with the other player survives the attack: no Response.
  it("02072:A:2 Brand son of Bain: not offered when the enemy is not defeated", () => {
    const { tab, run } = attacked(EFFECTS, WALL, 1);
    expect(run.state.cards[idsOf(tab, WALL)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("02072:response:1");
  });
});

describe("Keen-eyed Took (02073:A:2)", () => {
  // "Action: Return Keen-eyed Took to your hand to discard the top card of each player's deck.": two players with 3 cards each; the Took
  // goes back to the hand and each deck's top card is discarded.
  lineSpec("02073:A:2", "Keen-eyed Took: return him to your hand to discard the top card of each player's deck", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: TOOK, seat: 0 }], playerDeck: [...fillers(CARD, 3, 0), ...fillers(ALLY, 3, 1)] });
    const took = idsOf(tab, TOOK);
    const [top0, top1] = [tab.state.seats[0]?.deck[0] ?? "", tab.state.seats[1]?.deck[0] ?? ""];
    expect(triggers(tab.state, tab)).toContain("02073:action:1");
    const run = passAll(sendUnledgered(begin(tab.state), { type: "Trigger", cardId: took, effectId: "02073:action:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[took]?.zone).toBe("hand");
    expect(run.state.cards[top0]?.zone).toBe("discard");
    expect(run.state.cards[top1]?.zone).toBe("discard");
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.seats[1]?.deck).toHaveLength(2);
  });
});

describe("Rear Guard (02074:A:1)", () => {
  // The quest phase, two players: Aragorn, Gimli and the first player's ally commit, the Pal of the other player commits, Legolas stays
  // back (with `commit` false nobody commits). The Ally and the Snowbourn Scout (Leadership) and a Spirit ally are in play; Rear Guard is in
  // hand. The run stops in the quest phase's action window after the staging step.
  function committed(effects: readonly Effect[], commit = true): { tab: Table; run: Run } {
    const tab = table(effects, { seats: 2, start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: SCOUT, seat: 0 }, { code: SPIRIT_ALLY, seat: 0 }], hand: [{ code: REAR, seat: 0 }], deck: ["f0", "f0"] });
    let run = commit ? sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, ARAGORN), idsOf(tab, GIMLI), idsOf(tab, ALLY)] }, tab.ctx) : begin(tab.state);
    // Aragorn's Response to his commit is passed; the first player is done committing and the second commits.
    run = sendUnledgered(passAll(run, tab.ctx, { responses: true }), { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    if (commit) run = sendUnledgered(run, { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    // The second player is done committing: the staging step reveals the f0 and the quest phase's action window opens. With no hero committed, Rear
    // Guard is the only card that could be played there and it can change nothing, so no window opens and the phase moves on.
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.phase).toBe(commit ? "Quest" : "Travel");
    return { tab, run };
  }

  // "Quest Action: Discard a Leadership ally to give each hero committed to this quest +1 Willpower until the end of the phase.": the
  // Scout and the Ally are offered (the Spirit ally is not); the Scout is discarded; Aragorn, Gimli and the other player's Pal get +1,
  // Legolas and the committed Ally (not a hero) do not; at the end of the quest phase the bonus ends.
  lineSpec("02074:A:1", "Rear Guard: discard a Leadership ally to give each committed hero +1 Willpower until the end of the phase", (effects) => {
    const { tab, run: quested } = committed(effects);
    const [aragorn, gimli, legolas, pal, ally, scout] = [idsOf(tab, ARAGORN), idsOf(tab, GIMLI), idsOf(tab, LEGOLAS), idsOf(tab, PAL), idsOf(tab, ALLY), idsOf(tab, SCOUT)];
    expect(quested.state.cards[pal]?.committed).toBe(true);
    expect(quested.state.window?.kind).toBe("frameAction");
    let run = play({ ...quested, state: { ...quested.state, activeSeat: 0 } }, tab, idsOf(tab, REAR));
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([ally, scout].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: scout }, tab.ctx);
    expect(run.state.cards[scout]?.zone).toBe("discard");
    for (const [id, code, bonus] of [[aragorn, ARAGORN, 1], [gimli, GIMLI, 1], [pal, PAL, 1], [legolas, LEGOLAS, 0], [ally, ALLY, 0]] as const) {
      expect(stat(run.state, tab, id, "willpower")).toBe(printed(tab, code, "willpower") + bonus);
    }
    expect(stat(withMode(run.state, "travel"), tab, aragorn, "willpower")).toBe(printed(tab, ARAGORN, "willpower"));
  });

  // "Quest Action": in the planning phase it cannot be played.
  it("02074:A:1 Rear Guard: not played outside the quest phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }], hand: [{ code: REAR, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, REAR))).toBe(false);
  });

  // No hero is committed: the bonus would go to nobody, so the card is not played and no ally is discarded for nothing (rr.cost).
  it("02074:A:1 Rear Guard: not played when no hero is committed", () => {
    const { tab, run } = committed(EFFECTS, false);
    expect(canPlay({ ...run.state, activeSeat: 0 }, tab, idsOf(tab, REAR))).toBe(false);
  });
});

describe("Descendant of Thorondor (02075:A:1, A:2)", () => {
  // "Descendant of Thorondor cannot have restricted attachments.": Round Shield (restricted, "Attach to a character.") may go on Gimli and
  // the Eagle ally (another Eagle ally), not on the Descendant.
  lineSpec("02075:A:1", "Descendant of Thorondor: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: DESCENDANT, seat: 0 }, { code: EAGLE, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, SHIELD))).toEqual([idsOf(tab, GIMLI), idsOf(tab, EAGLE)].sort());
  });

  // Gimli and Legolas pay; the Descendant in hand (or in play, with Meneldor's Flight in hand); a Wall and the Frail in the staging area,
  // another Wall engaged with the player.
  const thorondor = (effects: readonly Effect[], zone: "hand" | "play"): Table =>
    table(effects, {
      heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }],
      ...(zone === "hand" ? { hand: [{ code: DESCENDANT, seat: 0 }, { code: FLIGHT, seat: 0 }] } : { allies: [{ code: DESCENDANT, seat: 0 }], hand: [{ code: FLIGHT, seat: 0 }] }),
      staging: [WALL, FRAIL],
      engaged: [{ code: WALL, seat: 0 }],
    });

  // "Response: After Descendant of Thorondor enters or leaves play, deal 2 damage to any 1 enemy in the staging area.": played from the
  // hand, the two enemies in the staging area are offered (not the one engaged), and the Wall chosen takes 2 damage.
  lineSpec("02075:A:2", "Descendant of Thorondor: after he enters play, deal 2 damage to an enemy in the staging area", (effects) => {
    const tab = thorondor(effects, "hand");
    const [staged = "", engaged = ""] = tab.ids[WALL] ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, DESCENDANT));
    expect(run.state.cards[idsOf(tab, DESCENDANT)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).toContain("02075:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, DESCENDANT), effectId: "02075:response:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([staged, idsOf(tab, FRAIL)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged }, tab.ctx);
    expect(run.state.cards[staged]?.damage).toBe(2);
    expect(run.state.cards[engaged]?.damage ?? 0).toBe(0);
  });

  // "or leaves play": Meneldor's Flight returns him to the hand; the Response is offered and the Wall in the staging area takes 2 damage.
  lineSpec("02075:A:2", "Descendant of Thorondor: after he leaves play, deal 2 damage to an enemy in the staging area", (effects) => {
    const tab = thorondor(effects, "play");
    const descendant = idsOf(tab, DESCENDANT);
    let run = play(begin(tab.state), tab, idsOf(tab, FLIGHT));
    expect(run.state.cards[descendant]?.zone).toBe("hand");
    expect(triggers(run.state, tab)).toContain("02075:response:2");
    run = sendUnledgered(run, { type: "Trigger", cardId: descendant, effectId: "02075:response:2" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, WALL) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WALL)]?.damage).toBe(2);
  });
});

describe("Meneldor's Flight (02076:A:1)", () => {
  // "Action: Choose an Eagle ally. Return that character to its owner's hand.": two players; the first player's Eagle and the other player's
  // Eagle are offered (an ally that is not an Eagle is not); the other player's Eagle goes back to his hand.
  lineSpec("02076:A:1", "Meneldor's Flight: return an Eagle ally to its owner's hand", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: EAGLE, seat: 0 }, { code: EAGLE, seat: 1 }, { code: ALLY, seat: 0 }], hand: [{ code: FLIGHT, seat: 0 }] });
    const [mine = "", theirs = ""] = tab.ids[EAGLE] ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, FLIGHT));
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([mine, theirs].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: theirs }, tab.ctx);
    expect(run.state.cards[theirs]?.zone).toBe("hand");
    expect(run.state.seats[1]?.hand).toContain(theirs);
    expect(run.state.cards[mine]?.zone).toBe("play");
  });

  // No Eagle ally in play: it is not played.
  it("02076:A:1 Meneldor's Flight: not played without an Eagle ally", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: FLIGHT, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, FLIGHT))).toBe(false);
  });
});

describe("The Riddermark's Finest (02077:A:1)", () => {
  const finest = (effects: readonly Effect[], scene: Scene): Table => table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: FINEST, seat: 0 }], ...scene });

  // "Action: Exhaust and discard The Riddermark's Finest to place 2 progress tokens on any location.": the active location and the one in the
  // staging area are offered; the one in the staging area takes 2 progress and the Finest is in the discard pile.
  lineSpec("02077:A:1", "The Riddermark's Finest: exhaust and discard him to place 2 progress on any location", (effects) => {
    const tab = finest(effects, { active: FIELD, staging: [FIELD] });
    const [active = "", staged = ""] = [tab.state.activeLocation ?? "", tab.state.staging[0] ?? ""];
    const id = idsOf(tab, FINEST);
    expect(triggers(tab.state, tab)).toContain("02077:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: id, effectId: "02077:action:1" }, tab.ctx);
    expect(run.state.cards[id]?.zone).toBe("discard");
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([active, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged }, tab.ctx);
    expect(run.state.cards[staged]?.progress).toBe(2);
    expect(run.state.cards[active]?.progress ?? 0).toBe(0);
  });

  // An exhausted Finest cannot pay the cost, and with no location the effect has nothing to change: the Action is not offered either way.
  it("02077:A:1 The Riddermark's Finest: not offered while exhausted or with no location", () => {
    const tab = finest(EFFECTS, { staging: [FIELD] });
    expect(triggers(updateCard(tab.state, idsOf(tab, FINEST), { exhausted: true }), tab)).not.toContain("02077:action:1");
    const none = finest(EFFECTS, {});
    expect(triggers(none.state, none)).not.toContain("02077:action:1");
  });
});

describe("Ride to Ruin (02078:A:1)", () => {
  const ruin = (effects: readonly Effect[], scene: Scene): Table => table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: RUIN, seat: 0 }], ...scene });

  // "Action: Discard a Rohan ally to choose a location. Place 3 progress tokens on that location.": the Rider and the Scout (Rohan) are
  // offered, the Spirit ally is not; the Rider is discarded; of the two locations the one in the staging area takes 3 progress.
  lineSpec("02078:A:1", "Ride to Ruin: discard a Rohan ally to place 3 progress on a location", (effects) => {
    const tab = ruin(effects, { allies: [{ code: RIDER, seat: 0 }, { code: SCOUT, seat: 0 }, { code: SPIRIT_ALLY, seat: 0 }], active: FIELD, staging: [FIELD] });
    const [active = "", staged = ""] = [tab.state.activeLocation ?? "", tab.state.staging[0] ?? ""];
    const [rider, scout] = [idsOf(tab, RIDER), idsOf(tab, SCOUT)];
    let run = play(begin(tab.state), tab, idsOf(tab, RUIN));
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([rider, scout].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: rider }, tab.ctx);
    expect(run.state.cards[rider]?.zone).toBe("discard");
    expect(run.state.cards[scout]?.zone).toBe("play");
    expect(choices(run.state, tab).sort()).toEqual([active, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: staged }, tab.ctx);
    expect(run.state.cards[staged]?.progress).toBe(3);
    expect(run.state.cards[active]?.progress ?? 0).toBe(0);
  });

  // No Rohan ally to discard: it is not played.
  it("02078:A:1 Ride to Ruin: not played without a Rohan ally", () => {
    const tab = ruin(EFFECTS, { allies: [{ code: SPIRIT_ALLY, seat: 0 }], staging: [FIELD] });
    expect(canPlay(tab.state, tab, idsOf(tab, RUIN))).toBe(false);
  });

  // No location in play: the progress has nowhere to go, so it is not played and no ally is discarded for nothing (rr.cost).
  it("02078:A:1 Ride to Ruin: not played without a location", () => {
    const tab = ruin(EFFECTS, { allies: [{ code: RIDER, seat: 0 }] });
    expect(canPlay(tab.state, tab, idsOf(tab, RUIN))).toBe(false);
  });
});

describe("Song of Travel (02081:A:1, A:2)", () => {
  // "Attach to a hero.": Aragorn and the other player's Pal are offered, the ally is not.
  lineSpec("02081:A:1", "Song of Travel: attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SONG, seat: 0 }] });
    const song = idsOf(tab, SONG);
    expect(hosts(tab, song)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, song, idsOf(tab, ARAGORN)).state.cards[song]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // "Attached hero gains a Spirit resource icon.": Aragorn alone cannot pay for Will of the West (Spirit); once Song of Travel is played on
  // him, in the state that intent returns, he can.
  lineSpec("02081:A:2", "Song of Travel: the attached hero gains a Spirit resource icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: SONG, seat: 0 }, { code: WILL, seat: 0 }], playerDeck: fillers(CARD, 2) });
    const aragorn = idsOf(tab, ARAGORN);
    const intent = { type: "PlayCard" as const, cardId: idsOf(tab, WILL), payments: [{ heroId: aragorn, amount: 1 }] };
    expect(refusal(tab.state, intent, tab.ctx)).not.toBeNull();
    const run = play(begin(tab.state), tab, idsOf(tab, SONG), aragorn);
    expect(refusal(run.state, intent, tab.ctx)).toBeNull();
  });
});

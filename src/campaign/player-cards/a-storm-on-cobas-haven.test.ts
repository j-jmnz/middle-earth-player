// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.action, rr.cost, rr.cannot, rr.hit-points, rr.resources,
// rr.resource-match, rr.discard-pile-and-victory-display, rr.player-elimination, rr.deckbuilding, rr.play-and-put-into-play,
// rr.refresh-phase, rr.planning-phase, rr.triggered-ability (data/rules/entries.json).
// The A Storm on Cobas Haven player cards, written from their card text (data/cards/SoCH.json; data/printed holds no ledger for these
// cards yet, so every intent goes through sendUnledgered): Na'asiyah 12109:A:1 and A:2, Rune-master 12110:A:1, Veteran Sword-elf 12112:A:1,
// Vigilant Guard 12113:A:1 and A:2, Windfola 12116:A:1 and A:2, Ioreth 12117:A:1 and A:2, The Houses of Healing 12118:A:1 and A:2, Justice
// Shall Be Done 12119:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, deckSaveFacts, discarded, endRound, enter, fillers, hosts, packRow, passAll, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const NAASIYAH = "12109";
const RUNE_MASTER = "12110";
const SWORD_ELF = "12112";
const GUARD = "12113";
const WINDFOLA = "12116";
const IORETH = "12117";
const HOUSES = "12118";
const JUSTICE = "12119";
// Elladan: a Tactics Ranger hero (not Leadership). Gondorian Spearman: a Tactics ally of cost 2.
const ELLADAN = "04028";
const SPEARMAN = "01029";
// Heroes with no text: Spirit, Tactics (not a Warrior), Lore, and a Tactics hero named Éowyn. A Healer ally of cost 0. The Pal is a
// Leadership Hobbit hero (test/harness/scene.ts); the Ally a Leadership ally with no Trait.
const SPIRIT = "spirit-hero";
const TACTICS = "tactics-hero";
const SAGE = "sage";
const EOWYN = "eowyn-tactics";
const HEALER = "healer";
const PAL = "pal";
const ALLY = "ally";
const SPIRIT_ALLY = "spirit-ally";
// An enemy no attack of these tests defeats.
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([NAASIYAH, RUNE_MASTER, SWORD_ELF, GUARD, WINDFOLA, IORETH, HOUSES, JUSTICE, ELLADAN, SPEARMAN]))]);
  const hero = (code: string, name: string, sphere: "spirit" | "tactics" | "lore") => definePrinted({ code, name, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 2, health: 5 });
  cards.set(SPIRIT, hero(SPIRIT, "Spirit", "spirit"));
  cards.set(TACTICS, hero(TACTICS, "Tactics", "tactics"));
  cards.set(SAGE, hero(SAGE, "Sage", "lore"));
  cards.set(EOWYN, hero(EOWYN, "Éowyn", "tactics"));
  cards.set(HEALER, definePrinted({ code: HEALER, name: "Healer", type: "ally", sphere: "lore", cost: 0, willpower: 1, attack: 0, defense: 0, health: 1, traits: ["Healer"] }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 5, health: 9 }));
  base = { ...starter, cards };
});

const playable = (state: Table["state"], tab: Table, id: string): boolean => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);

describe("Na'asiyah (12109:A:1, A:2)", () => {
  // "Resources in Na'asiyah's resource pool cannot be used to pay for allies.": her resources cannot pay for the Gondorian Spearman (a
  // Tactics ally), and the Tactics hero's can.
  lineSpec("12109:A:1", "Na'asiyah: her resources cannot pay for allies", (effects) => {
    const tab = table(effects, { heroes: [{ code: NAASIYAH, seat: 0 }, { code: TACTICS, seat: 0 }], hand: [{ code: SPEARMAN, seat: 0 }] });
    const spearman = idsOf(tab, SPEARMAN);
    expect(refusal(tab.state, { type: "PlayCard", cardId: spearman, payments: [{ heroId: idsOf(tab, NAASIYAH), amount: 2 }] }, tab.ctx)).not.toBeNull();
    expect(refusal(tab.state, { type: "PlayCard", cardId: spearman, payments: [{ heroId: idsOf(tab, TACTICS), amount: 2 }] }, tab.ctx)).toBeNull();
  });

  // Her resources still pay for an attachment: the Vigilant Guard (Tactics, cost 3) on her.
  it("12109:A:1 Na'asiyah: her resources pay for a card that is not an ally", () => {
    const tab = table(EFFECTS, { heroes: [{ code: NAASIYAH, seat: 0 }], hand: [{ code: GUARD, seat: 0 }] });
    const naasiyah = idsOf(tab, NAASIYAH);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, GUARD), hostId: naasiyah, payments: [{ heroId: naasiyah, amount: 3 }] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GUARD)]?.host).toBe(naasiyah);
  });

  // "Action: While Na'asiyah is attacking or defending, pay 1 resource from her resource pool to give her +2 Attack or +2 Defense for this
  // attack.": she attacks the Wall, pays 1 and strikes with Attack 2 + 2; the bonus ends with the attack.
  lineSpec("12109:A:2", "Na'asiyah: while attacking, pay 1 resource from her pool for +2 Attack for this attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: NAASIYAH, seat: 0 }, { code: TACTICS, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const naasiyah = idsOf(tab, NAASIYAH);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [naasiyah] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("12109:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: naasiyah, effectId: "12109:action:1", payments: [{ heroId: naasiyah, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["attack", "defense"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "attack" }, tab.ctx);
    expect(run.state.cards[naasiyah]?.resources).toBe(6 - 1);
    expect(stat(run.state, tab, naasiyah, "attack")).toBe(printed(tab, NAASIYAH, "attack") + 2);
    expect(stat(run.state, tab, naasiyah, "defense")).toBe(printed(tab, NAASIYAH, "defense"));
    const from = run.steps.length;
    run = passAll(run, tab.ctx, { responses: true });
    const strikes = run.steps.slice(from).flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step.attack] : []));
    expect(strikes).toEqual([printed(tab, NAASIYAH, "attack") + 2]);
    expect(stat(run.state, tab, naasiyah, "attack")).toBe(printed(tab, NAASIYAH, "attack"));
  });

  // While she defends: +2 Defense, read by the enemy's strike.
  lineSpec("12109:A:2", "Na'asiyah: while defending, pay 1 resource from her pool for +2 Defense for this attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: NAASIYAH, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const naasiyah = idsOf(tab, NAASIYAH);
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: naasiyah }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("12109:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: naasiyah, effectId: "12109:action:1", payments: [{ heroId: naasiyah, amount: 1 }] }, tab.ctx);
    const from = run.steps.length;
    run = passAll(sendUnledgered(run, { type: "Choose", optionId: "defense" }, tab.ctx), tab.ctx, { responses: true });
    const strikes = run.steps.slice(from).flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.defense] : []));
    expect(strikes).toEqual([printed(tab, NAASIYAH, "defense") + 2]);
    expect(stat(run.state, tab, naasiyah, "defense")).toBe(printed(tab, NAASIYAH, "defense"));
  });

  // Neither attacking nor defending, in the planning phase and while the Wall's attack waits for a defender: not offered.
  it("12109:A:2 Na'asiyah: not offered while she neither attacks nor defends", () => {
    const tab = table(EFFECTS, { heroes: [{ code: NAASIYAH, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("12109:action:1");
    const run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(triggers(run.state, tab)).not.toContain("12109:action:1");
  });
});

describe("Rune-master (12110:A:1)", () => {
  // "Attach to a Ranger or Leadership hero.": Elladan (a Ranger, Tactics) and the Pal (Leadership) are offered; the Spirit hero (neither)
  // and the Ally (a Leadership ally) are not.
  lineSpec("12110:A:1", "Rune-master: Attach to a Ranger or Leadership hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ELLADAN, seat: 0 }, { code: PAL, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: RUNE_MASTER, seat: 0 }] });
    const master = idsOf(tab, RUNE_MASTER);
    expect(hosts(tab, master)).toEqual([idsOf(tab, ELLADAN), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, master, idsOf(tab, ELLADAN)).state.cards[master]?.host).toBe(idsOf(tab, ELLADAN));
  });
});

describe("Veteran Sword-elf (12112:A:1)", () => {
  // "Veteran Sword-elf gets +1 Attack and +1 Defense for each copy of Veteran Sword-elf in your discard pile.": two copies in the first
  // player's discard pile give +2; the other player's copy and a Gondorian Spearman in the pile add nothing. The Pass that ends the
  // planning phase brings the table up to date.
  lineSpec("12112:A:1", "Veteran Sword-elf: +1 Attack and +1 Defense for each copy in your discard pile", (effects) => {
    const start = table(effects, { seats: 2, heroes: [{ code: TACTICS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: SWORD_ELF, seat: 0 }] });
    const elf = idsOf(start, SWORD_ELF);
    const { tab } = discarded(start, [[SWORD_ELF, 0], [SWORD_ELF, 0], [SWORD_ELF, 1], [SPEARMAN, 0]]);
    const run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(stat(run.state, tab, elf, "attack")).toBe(printed(tab, SWORD_ELF, "attack") + 2);
    expect(stat(run.state, tab, elf, "defense")).toBe(printed(tab, SWORD_ELF, "defense") + 2);
  });
});

describe("Vigilant Guard (12113:A:1, A:2)", () => {
  // "Attach to a Warrior character. Limit 1 per character.": Na'asiyah (a Warrior hero) and the Veteran Sword-elf (a Warrior ally) are
  // offered, the Tactics hero is not; once the Sword-elf has one, the second Guard is offered only Na'asiyah.
  lineSpec("12113:A:1", "Vigilant Guard: Attach to a Warrior character, limit 1 per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: NAASIYAH, seat: 0 }, { code: TACTICS, seat: 0 }], allies: [{ code: SWORD_ELF, seat: 0 }], hand: [{ code: GUARD, seat: 0 }, { code: GUARD, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[GUARD] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, NAASIYAH), idsOf(tab, SWORD_ELF)].sort());
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: first, hostId: idsOf(tab, SWORD_ELF), payments: [{ heroId: idsOf(tab, TACTICS), amount: 3 }] }, tab.ctx);
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, SWORD_ELF));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, NAASIYAH)]);
  });

  // "Attached character gets +2 hit points.": played on the Sword-elf (3 hit points).
  lineSpec("12113:A:2", "Vigilant Guard: attached character gets +2 hit points", (effects) => {
    const tab = table(effects, { heroes: [{ code: TACTICS, seat: 0 }], allies: [{ code: SWORD_ELF, seat: 0 }], hand: [{ code: GUARD, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, GUARD), idsOf(tab, SWORD_ELF));
    expect(stat(run.state, tab, idsOf(tab, SWORD_ELF), "hitPoints")).toBe(3 + 2);
  });
});

describe("Windfola (12116:A:1, A:2)", () => {
  // "Attach to a Spirit hero, or to Éowyn. Restricted.": the Spirit hero and Éowyn (a Tactics hero) are offered; the Tactics hero, the Pal
  // and the Spirit ally are not.
  lineSpec("12116:A:1", "Windfola: Attach to a Spirit hero, or to Éowyn", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }, { code: EOWYN, seat: 0 }, { code: TACTICS, seat: 0 }], allies: [{ code: SPIRIT_ALLY, seat: 0 }], hand: [{ code: WINDFOLA, seat: 0 }] });
    const windfola = idsOf(tab, WINDFOLA);
    expect(hosts(tab, windfola)).toEqual([idsOf(tab, SPIRIT), idsOf(tab, EOWYN)].sort());
    expect(play(begin(tab.state), tab, windfola, idsOf(tab, EOWYN)).state.cards[windfola]?.host).toBe(idsOf(tab, EOWYN));
  });

  // "Attached character gets +1 Willpower.": played on the Spirit hero.
  lineSpec("12116:A:2", "Windfola: attached character gets +1 Willpower", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], hand: [{ code: WINDFOLA, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, WINDFOLA), idsOf(tab, SPIRIT));
    expect(stat(run.state, tab, idsOf(tab, SPIRIT), "willpower")).toBe(2 + 1);
  });
});

describe("Ioreth (12117:A:1, A:2)", () => {
  // "Cannot attack or defend.": an attack with her is refused, and so is declaring her a defender.
  lineSpec("12117:A:1", "Ioreth: cannot attack or defend", (effects) => {
    const tab = table(effects, { heroes: [{ code: SAGE, seat: 0 }], allies: [{ code: IORETH, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const ioreth = idsOf(tab, IORETH);
    expect(refusal(attacking(tab.state), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [ioreth] }, tab.ctx)).not.toBeNull();
    const run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: ioreth }, tab.ctx)).not.toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: idsOf(tab, SAGE) }, tab.ctx)).toBeNull();
  });

  // Ioreth in play for the first player; the Sage (Lore) of each player; the first player's Sage has `damage` damage.
  function scene(effects: readonly Effect[], damage: number): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: SAGE, seat: 0 }, { code: SAGE, seat: 1 }], allies: [{ code: IORETH, seat: 0 }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, SAGE), { damage }) };
  }

  // "Action: Spend 1 Lore resource and exhaust Ioreth. Then, heal 3 points of damage on a character. Any player may trigger this action.":
  // the first player passes his planning actions, and the second player triggers it and spends a Lore resource of his Sage; Ioreth exhausts
  // and the first player's Sage goes from 4 damage to 1.
  lineSpec("12117:A:2", "Ioreth: spend 1 Lore resource and exhaust her to heal 3 damage on a character, any player may trigger it", (effects) => {
    const tab = scene(effects, 4);
    const [ioreth, sage, other] = [idsOf(tab, IORETH), idsOf(tab, SAGE), tab.ids[SAGE]?.[1] ?? ""];
    let run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    expect(triggers(run.state, tab)).toContain("12117:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: ioreth, effectId: "12117:action:1", payments: [{ heroId: other, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[ioreth]?.exhausted).toBe(true);
    expect(run.state.cards[other]?.resources).toBe(6 - 1);
    expect(run.state.window?.kind).toBe("choose");
    run = sendUnledgered(run, { type: "Choose", optionId: sage }, tab.ctx);
    expect(run.state.cards[sage]?.damage).toBe(4 - 3);
  });

  // No character has damage: the heal can change nothing, so the Action is not offered and nothing is spent (rr.triggered-ability).
  it("12117:A:2 Ioreth: not offered when no character has damage", () => {
    const tab = scene(EFFECTS, 0);
    expect(triggers(tab.state, tab)).not.toContain("12117:action:1");
  });
});

describe("The Houses of Healing (12118:A:1, A:2)", () => {
  // Two seats at the refresh phase's last action window (7.4, still the refresh phase): the second player, now first player, passes, so
  // the first player may act. The Sage pays; Ioreth and the Healer ally (Healers) are ready; the second player's Pal is in his discard pile and the Spirit hero in the first player's.
  function scene(effects: readonly Effect[]): { tab: Table; run: Run; pal: string; spirit: string } {
    const start = table(effects, { seats: 2, heroes: [{ code: SAGE, seat: 0 }, { code: TACTICS, seat: 1 }], allies: [{ code: IORETH, seat: 0 }, { code: HEALER, seat: 0 }], hand: [{ code: HOUSES, seat: 0 }] });
    const { tab, ids: [pal = "", spirit = ""] } = discarded(start, [[PAL, 1], [SPIRIT, 0]]);
    const run = sendUnledgered(enter(tab.state, tab, "refresh"), { type: "Pass" }, tab.ctx);
    expect([run.state.window?.kind, run.state.activeSeat]).toEqual(["frameAction", 0]);
    return { tab, run, pal, spirit };
  }

  // "You may exhaust any number of Healer characters you control as part of this card's cost. Reduce the cost to play this card by 1 for each
  // Healer character you exhaust in this way.": the Sage pays 3 of the 5, and both Healers exhaust for the rest.
  lineSpec("12118:A:1", "The Houses of Healing: each Healer exhausted for the cost reduces it by 1", (effects) => {
    const { tab, run: start } = scene(effects);
    const [sage, houses] = [idsOf(tab, SAGE), idsOf(tab, HOUSES)];
    const run = sendUnledgered(start, { type: "PlayCard", cardId: houses, payments: [{ heroId: sage, amount: 3 }] }, tab.ctx);
    expect(run.state.cards[sage]?.resources).toBe(6 - 3);
    expect(run.state.cards[idsOf(tab, IORETH)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, HEALER)]?.exhausted).toBe(true);
  });

  // "Refresh Action: Choose a hero in any player's discard pile. Put that hero into play under its owner's control, with 1 damage token on
  // it.": both discarded heroes are offered; the second player's Pal comes back among his heroes, ready, with 1 damage.
  lineSpec("12118:A:2", "The Houses of Healing: a hero in any player's discard pile comes into play under its owner's control with 1 damage", (effects) => {
    const { tab, run: start, pal, spirit } = scene(effects);
    let run = sendUnledgered(start, { type: "PlayCard", cardId: idsOf(tab, HOUSES), payments: [{ heroId: idsOf(tab, SAGE), amount: 5 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([pal, spirit].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[pal]).toMatchObject({ zone: "heroes", controller: 1, damage: 1, exhausted: false });
    expect(run.state.cards[spirit]?.zone).toBe("discard");
    // "You may exhaust": paid in full, the Healers stay ready.
    expect(run.state.cards[idsOf(tab, IORETH)]?.exhausted).toBe(false);
    expect(run.state.seats[1]?.heroes).toContain(pal);
  });

  // "Refresh Action": in the planning phase it cannot be played.
  it("12118:A:2 The Houses of Healing: not offered outside the refresh phase", () => {
    const { tab } = scene(EFFECTS);
    expect(playable(tab.state, tab, idsOf(tab, HOUSES))).toBe(false);
  });
});

describe("Justice Shall Be Done (12119:A:1, A:2)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/SoCH.json), which the DeckLimit record restates.
  it("12119:A:1 Justice Shall Be Done: a deck holds at most 1 copy", () => {
    const row = packRow("SoCH", JUSTICE);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: JUSTICE, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: JUSTICE, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: JUSTICE });
  });

  // "Planning Action: Add Justice Shall Be Done to the victory display to draw 3 cards and add 3 resources to the resource pool of each hero
  // you control. At the end of the round, you are eliminated from the game.": in a two-player game the first player's card goes to the
  // victory display, he draws 3 of his 4 cards, his two heroes gain 3 each and the other player's hero none; at the end of the round he is
  // eliminated and the other player is not.
  lineSpec("12119:A:2", "Justice Shall Be Done: victory display, draw 3, 3 resources on each hero you control, eliminated at the end of the round", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SAGE, seat: 0 }, { code: TACTICS, seat: 1 }], hand: [{ code: JUSTICE, seat: 0 }], playerDeck: fillers("card", 4) });
    const justice = idsOf(tab, JUSTICE);
    const run = play(begin(tab.state), tab, justice);
    expect(run.state.cards[justice]?.zone).toBe("victory");
    expect(run.state.seats[0]?.hand).toHaveLength(3);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
    expect([idsOf(tab, PAL), idsOf(tab, SAGE), idsOf(tab, TACTICS)].map((id) => run.state.cards[id]?.resources)).toEqual([9, 9, 6]);
    expect(run.state.seats[0]?.eliminated).toBe(false);
    const ended = endRound(run.state, tab);
    expect(ended.state.seats.map((seat) => seat.eliminated)).toEqual([true, false]);
  });

  // "Planning Action": not in the quest phase.
  it("12119:A:2 Justice Shall Be Done: not offered outside the planning phase", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: PAL, seat: 0 }], hand: [{ code: JUSTICE, seat: 0 }], playerDeck: fillers("card", 4) });
    expect(playable(tab.state, tab, idsOf(tab, JUSTICE))).toBe(false);
  });
});

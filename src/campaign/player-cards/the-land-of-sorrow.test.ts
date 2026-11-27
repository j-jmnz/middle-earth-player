// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.forced, rr.action, rr.triggered-ability, rr.refresh-phase, rr.quest-phase,
// rr.attack-strength, rr.card-types (data/rules/entries.json).
// The Land of Sorrow heroes, allies, event and contract, each printed line tested from the words on the card (lineSpec,
// test/harness/line-spec.ts): Gwaihir 22108:A:2, Hobbit Archer 22109:A:2, Eagle Emissary 22113:A:1 and A:2, Smoke and Think 22116:A:1,
// Wilyador 22117:A:2, Messenger of the King 22134:B:1. The lines are the text of data/cards/TLoS.json (data/printed holds the
// pack's ledger), so every line is checked against it. The attachments are in the-land-of-sorrow-attachments.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, enter, hosts, passAll, playCode, playerTableFor, printed, questUntil, stat } from "../../../test/harness/player-table.ts";

const GWAIHIR = "22108";
const ARCHER = "22109";
const HEALING = "22112";
const EMISSARY = "22113";
const PIPE = "22115";
const SMOKE = "22116";
const WILYADOR = "22117";
const MESSENGER = "22134";
// Core Aragorn (Leadership), Legolas (Tactics), Éowyn (Spirit), Denethor (Lore); Citadel Plate (a restricted Tactics attachment,
// "Attach to a hero."). Spare Pipe (a Pipe) and Song of Healing ("Attach to a hero.") are cards of this pack.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const PLATE = "01040";
// A plain Leadership ally, from the scene kit.
const ALLY = "ally";
// A restricted attachment with no text; a Spirit ally of cost 3.
const GEAR = "gear";
const COSTLY = "costly";
// The test threat is 8: an enemy with engagement cost 50, and one with engagement cost 2 (starter-scene.ts).
const DEAR = "dear";
const CHEAP = "cheap";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [GWAIHIR, ARCHER, HEALING, EMISSARY, PIPE, SMOKE, WILYADOR, MESSENGER, ARAGORN, LEGOLAS, EOWYN, DENETHOR, PLATE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", sphere: "neutral", cost: 0, keywords: { restricted: true } }));
  cards.set(COSTLY, definePrinted({ code: COSTLY, name: "Costly", type: "ally", sphere: "spirit", cost: 3, willpower: 1, attack: 1, defense: 1, health: 2 }));
  base = { ...starter, cards };
});

// Commits `commit` and passes until `stop` holds, the game asks a question, or the quest is over.
describe("Gwaihir (22108:A:2)", () => {
  // "Cannot have restricted attachments.": Citadel Plate (restricted, "Attach to a hero.") may go on Legolas, not on Gwaihir.
  // "Gwaihir does not ready during the refresh phase.": both exhausted, the refresh phase readies Legolas and leaves Gwaihir exhausted.
  lineSpec("22108:A:2", "cannot have restricted attachments and does not ready during the refresh phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: GWAIHIR, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: PLATE, seat: 0 }] });
    const [gwaihir, legolas] = [idsOf(tab, GWAIHIR), idsOf(tab, LEGOLAS)];
    expect(hosts(tab, idsOf(tab, PLATE))).toEqual([legolas]);
    const tired = updateCard(updateCard(tab.state, gwaihir, { exhausted: true }), legolas, { exhausted: true });
    const run = enter(tired, tab, "refresh");
    expect(run.state.cards[legolas]?.exhausted).toBe(false);
    expect(run.state.cards[gwaihir]?.exhausted).toBe(true);
  });
});

describe("Hobbit Archer (22109:A:2)", () => {
  // The Archer alone attacks an enemy engaged with its player; the attack strength of the strike.
  function struck(effects: readonly Effect[], enemy: string): { tab: Table; attack: number[] } {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ARCHER, seat: 0 }], engaged: [{ code: enemy, seat: 0 }] });
    const run = passAll(send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: [idsOf(tab, ARCHER)] }, tab.ctx), tab.ctx);
    return { tab, attack: run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step.attack] : [])) };
  }

  // "Hobbit Archer gets +1 Attack while attacking an enemy with a higher engagement cost than your threat.": the enemy's engagement cost
  // 50 is above the threat 8, so the Archer (Attack 1) strikes with 2. Out of the attack it has its printed Attack.
  lineSpec("22109:A:2", "+1 Attack while attacking an enemy with an engagement cost higher than your threat", (effects) => {
    const { tab, attack } = struck(effects, DEAR);
    expect(attack).toEqual([printed(tab, ARCHER, "attack") + 1]);
    expect(stat(tab.state, tab, idsOf(tab, ARCHER), "attack")).toBe(printed(tab, ARCHER, "attack"));
  });

  // An enemy with engagement cost 2 (below the threat 8): no bonus.
  it("22109:A:2 no bonus against an enemy with an engagement cost lower than your threat", () => {
    const { tab, attack } = struck(EFFECTS, CHEAP);
    expect(attack).toEqual([printed(tab, ARCHER, "attack")]);
  });
});

describe("Eagle Emissary, Wilyador (22113:A:1, 22117:A:2)", () => {
  // "Cannot have restricted attachments.": the restricted Gear may go on Aragorn and the plain ally, not on the Eagle.
  for (const [line, code] of [["22113:A:1", EMISSARY], ["22117:A:2", WILYADOR]] as const) {
    lineSpec(line, `${code === EMISSARY ? "Eagle Emissary" : "Wilyador"}: cannot have restricted attachments`, (effects) => {
      const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: GEAR, seat: 0 }] });
      const offered = hosts(tab, idsOf(tab, GEAR));
      expect(offered).toContain(idsOf(tab, ARAGORN));
      expect(offered).toContain(idsOf(tab, ALLY));
      expect(offered).not.toContain(idsOf(tab, code));
    });
  }
});

describe("Eagle Emissary (22113:A:2)", () => {
  // The Emissary quests alone against an empty staging area, with Legolas (Tactics) or Aragorn (no Tactics icon) as the hero.
  function emissary(effects: readonly Effect[], hero: string): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: hero, seat: 0 }], allies: [{ code: EMISSARY, seat: 0 }], deck: ["f0"] }, 2);
    return { tab, run: questUntil(tab, [idsOf(tab, EMISSARY)]) };
  }

  // "Forced: After Eagle Emissary quests successfully, pay 1 Tactics resource or discard it from play.": Legolas holds Tactics
  // resources, so the player chooses; paying spends 1 of Legolas's and keeps the Emissary in play.
  lineSpec("22113:A:2", "after it quests successfully, pay 1 Tactics resource to keep it", (effects) => {
    const { tab, run: asked } = emissary(effects, LEGOLAS);
    expect(asked.state.window?.kind).toBe("choose");
    expect(choices(asked.state, tab).sort()).toEqual(["discard", "pay"]);
    const run = send(asked, { type: "Choose", optionId: "pay" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.resources).toBe(2 - 1);
    expect(run.state.cards[idsOf(tab, EMISSARY)]?.zone).toBe("play");
  });

  lineSpec("22113:A:2", "after it quests successfully, the player may discard it instead", (effects) => {
    const { tab, run: asked } = emissary(effects, LEGOLAS);
    expect(asked.state.window?.kind).toBe("choose");
    const run = send(asked, { type: "Choose", optionId: "discard" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.resources).toBe(2);
    expect(run.state.cards[idsOf(tab, EMISSARY)]?.zone).toBe("discard");
  });

  // No Tactics resource to pay (Aragorn is Leadership): the Emissary is discarded, Aragorn keeps his resources.
  lineSpec("22113:A:2", "with no Tactics resource it is discarded", (effects) => {
    const { tab, run } = emissary(effects, ARAGORN);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(2);
    expect(run.state.cards[idsOf(tab, EMISSARY)]?.zone).toBe("discard");
  });

  // Aragorn quests and the Emissary does not: it stays.
  it("22113:A:2 nothing happens when the Emissary did not quest", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: EMISSARY, seat: 0 }], deck: ["f0"] }, 2);
    const run = questUntil(tab, [idsOf(tab, ARAGORN)]);
    // The quest was won: Aragorn's 2 Willpower against the staging area's 0 is 2 progress on the stage.
    expect(run.state.mode).toBe("travel");
    expect(Object.values(run.state.cards).find((card) => card.zone === "questStage")?.progress).toBe(2);
    const after = passAll(run, tab.ctx, { responses: true });
    expect(after.state.window?.kind).not.toBe("choose");
    expect(after.state.cards[idsOf(tab, EMISSARY)]?.zone).toBe("play");
  });
});

describe("Smoke and Think (22116:A:1)", () => {
  // Éowyn (Spirit) and Aragorn each hold a Spare Pipe; Smoke and Think and two Costly allies (cost 3) in hand. `other` gives the second
  // player a Pipe on his hero instead of Aragorn's.
  function smoke(effects: readonly Effect[], other = false): Table {
    // The scene puts attached cards under the first player's control: the Pipe for Aragorn enters play under his controller's.
    const seat = other ? 1 : 0;
    const scene = table(effects, { seats: other ? 2 : 1, heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat }], allies: [{ code: PIPE, seat: 0 }, { code: PIPE, seat }], hand: [{ code: SMOKE, seat: 0 }, { code: COSTLY, seat: 0 }, { code: COSTLY, seat: 0 }] });
    const [own = "", theirs = ""] = scene.ids[PIPE] ?? [];
    return attach(scene, [[own, idsOf(scene, EOWYN)], [theirs, idsOf(scene, ARAGORN)]]);
  }
  const costlies = (tab: Table): string[] => tab.ids[COSTLY] ?? [];

  // "Action: Reduce the cost of the next card you play by 1 for each Pipe you control.": two Pipes, so the next Costly costs 1 and Éowyn
  // pays 1; the Costly after it costs its printed 3.
  lineSpec("22116:A:1", "the next card you play costs 1 less for each Pipe you control", (effects) => {
    const tab = smoke(effects);
    const [first = "", second = ""] = costlies(tab);
    let run = playCode(tab, SMOKE);
    expect(playCost(run.state, first, 0, tab.ctx)).toBe(3 - 2);
    run = send(run, { type: "PlayCard", cardId: first, payments: [{ heroId: idsOf(tab, EOWYN), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[first]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, EOWYN)]?.resources).toBe(6 - 1);
    expect(playCost(run.state, second, 0, tab.ctx)).toBe(3);
  });

  // "you control": the second player's Pipe is not counted, so the reduction is 1.
  it("22116:A:1 does not count another player's Pipe", () => {
    const tab = smoke(EFFECTS, true);
    const run = playCode(tab, SMOKE);
    expect(playCost(run.state, costlies(tab)[0] ?? "", 0, tab.ctx)).toBe(3 - 1);
  });

  // With no Pipe the reduction is 0 and the event changes nothing: it is not offered.
  it("22116:A:1 is not offered when you control no Pipe", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: SMOKE, seat: 0 }, { code: COSTLY, seat: 0 }] });
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, SMOKE))).toBe(false);
  });
});

describe("Messenger of the King (22134:B:1)", () => {
  // "Attached ally loses the ally card type and gains the hero card type": with the Messenger on its side B, the ally is among its
  // controller's heroes, and Song of Healing ("Attach to a hero.") may go on it.
  lineSpec("22134:B:1", "the attached ally becomes a hero", (effects) => {
    const tab = sideB(effects, "B");
    const ally = idsOf(tab, ALLY);
    const state = settle(tab.state, tab.ctx, []);
    expect(state.cards[ally]?.zone).toBe("heroes");
    expect(state.seats[0]?.heroes).toContain(ally);
    expect(hosts(tab, idsOf(tab, HEALING), state)).toContain(ally);
  });

  // On its side A the Messenger gives nothing: the ally stays an ally.
  it("22134:B:1 the ally stays an ally while the Messenger shows side A", () => {
    const tab = sideB(EFFECTS, "A");
    const ally = idsOf(tab, ALLY);
    const state = settle(tab.state, tab.ctx, []);
    expect(state.cards[ally]?.zone).toBe("play");
    expect(hosts(tab, idsOf(tab, HEALING), state)).not.toContain(ally);
  });
});

// The Messenger of the King attached to the plain ally, showing `face`; Denethor, and Song of Healing in hand. The settle sweep moves an
// ally that gained the hero card type among its controller's heroes (families/play/sweep.ts).
function sideB(effects: readonly Effect[], face: "A" | "B"): Table {
  const scene = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }, { code: MESSENGER, seat: 0 }], hand: [{ code: HEALING, seat: 0 }] });
  const messenger = idsOf(scene, MESSENGER);
  return attach({ ...scene, state: updateCard(scene.state, messenger, { face }) }, [[messenger, idsOf(scene, ALLY)]]);
}

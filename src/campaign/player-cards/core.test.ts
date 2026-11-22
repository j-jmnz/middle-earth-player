// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.hit-points, rr.engaged, rr.active-location (data/rules/entries.json).
// Core Set player cards, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): 01026:A:1,
// 01027:A:1, 01027:A:3, 01036:A:2, 01039:A:1, 01040:A:1, 01040:A:2, 01041:A:1, 01041:A:2, 01042:A:1, 01055:A:1, 01055:A:2,
// 01056:A:1, 01056:A:2, 01057:A:1, 01069:A:1, 01069:A:2, 01070:A:1, 01071:A:1, 01072:A:1 (data/printed/fellowship-of-the-ring.json).
import { beforeAll, describe, expect } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode, type ScenarioState } from "../../rules/core/state.ts";
import { attackBarred, syncConstants } from "../../rules/interpret/constants.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents, legalTargets } from "../../rules/engine/reduce.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import { fund, payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, buildTable, idsOf, passWindows, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";

const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const LEGOLAS = "01005";
const THALIN = "01006";
const EOWYN = "01007";
const DENETHOR = "01010";
const TOOK = "01043";
const STEWARD = "01026";
const STONE = "01027";
const THICKET = "01036";
const GONDOLIN = "01039";
const PLATE = "01040";
const AXE = "01041";
const HORN = "01042";
const FAVOR = "01055";
const POWER = "01056";
const COURAGE = "01057";
const SNARE = "01069";
const PROTECTOR = "01070";
const DARK = "01071";
const PRESERVATION = "01072";
// A location in the staging area and one as the active location, both with printed Threat.
const BAMFURLONG = "141034";
const GREEN_HILL = "141036";
const ORC = "orc";
const PAL = "pal";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, THEODRED, GIMLI, LEGOLAS, THALIN, EOWYN, DENETHOR, TOOK, STEWARD, STONE, THICKET, GONDOLIN, PLATE, AXE, HORN, FAVOR, POWER, COURAGE, SNARE, PROTECTOR, DARK, PRESERVATION, BAMFURLONG, GREEN_HILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 40, attack: 3, defense: 1, health: 5 }));
  base = { ...starter, cards };
});

// The table on the records under test, each hero funded, the constants brought up to date as the reducer does after an intent.
function table(effects: readonly Effect[], scene: Scene, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene, effects });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

// The cards the engine offers as the host of the attachment in hand.
function hosts(tab: Table, code: string): string[] {
  return [...legalTargets(tab.state, { type: "PlayCard", cardId: idsOf(tab, code) }, tab.ctx)].sort();
}

function stat(state: ScenarioState, tab: Table, id: string, which: "attack" | "defense" | "hitPoints" | "willpower" | "threat"): number {
  const card = state.cards[id];
  if (!card) throw new Error(`no card ${id}`);
  return modifiedStat(state, card, which, tab.ctx.cards);
}

function printed(tab: Table, code: string, which: "attack" | "defense" | "health" | "willpower"): number {
  return tab.ctx.cards.get(code)?.[which] ?? 0;
}

// "Attach to a hero.": in a two-player game the heroes of both players are offered and no ally is; the card goes onto the
// other player's hero, who gains control of it (rr.attachment-cards). `payer` is a hero of the card's sphere.
function heroOnly(effects: readonly Effect[], code: string, payer: string): void {
  const tab = table(effects, { seats: 2, heroes: [{ code: payer, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }], hand: [{ code, seat: 0 }] });
  expect(hosts(tab, code)).toEqual([idsOf(tab, payer), idsOf(tab, PAL)].sort());
  const card = idsOf(tab, code);
  expect(refusal(tab.state, { type: "PlayCard", cardId: card, hostId: idsOf(tab, ALLY), payments: payFor(tab.state, tab.ctx, card) }, tab.ctx)).toBe("That host is illegal");
  const run = send(begin(tab.state), { type: "PlayCard", cardId: card, hostId: idsOf(tab, PAL), payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
  expect(run.state.cards[card]?.host).toBe(idsOf(tab, PAL));
}

// The card on a hero of the scene, the constants up to date.
function onHero(effects: readonly Effect[], code: string, heroes: readonly string[], host: string = heroes[0] ?? ""): Table {
  return table(effects, { heroes: heroes.map((hero) => ({ code: hero, seat: 0 })), attached: [{ code, host }] });
}

describe("Attach to a hero (the attach-to lines)", () => {
  lineSpec("01026:A:1", "Steward of Gondor: Attach to a hero.", (effects) => heroOnly(effects, STEWARD, ARAGORN));
  lineSpec("01027:A:1", "Celebrían's Stone: Attach to a hero.", (effects) => heroOnly(effects, STONE, ARAGORN));
  lineSpec("01039:A:1", "Blade of Gondolin: Attach to a hero.", (effects) => heroOnly(effects, GONDOLIN, GIMLI));
  lineSpec("01040:A:1", "Citadel Plate: Attach to a hero.", (effects) => heroOnly(effects, PLATE, GIMLI));
  lineSpec("01041:A:1", "Dwarven Axe: Attach to a hero.", (effects) => heroOnly(effects, AXE, GIMLI));
  lineSpec("01042:A:1", "Horn of Gondor: Attach to a hero.", (effects) => heroOnly(effects, HORN, GIMLI));
  lineSpec("01055:A:1", "The Favor of the Lady: Attach to a hero.", (effects) => heroOnly(effects, FAVOR, EOWYN));
  lineSpec("01057:A:1", "Unexpected Courage: Attach to a hero.", (effects) => heroOnly(effects, COURAGE, EOWYN));
  lineSpec("01070:A:1", "Protector of Lórien: Attach to a hero.", (effects) => heroOnly(effects, PROTECTOR, DENETHOR));
});

describe("Self Preservation (01072:A:1)", () => {
  // "Attach to a character.": every hero and ally in play is offered, the other player's too (rr.attachment-cards).
  lineSpec("01072:A:1", "Self Preservation: Attach to a character.", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }], hand: [{ code: PRESERVATION, seat: 0 }] });
    expect(hosts(tab, PRESERVATION)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, PAL), ...(tab.ids[ALLY] ?? [])].sort());
    const card = idsOf(tab, PRESERVATION);
    const other = tab.ids[ALLY]?.[1] ?? "";
    const run = send(begin(tab.state), { type: "PlayCard", cardId: card, hostId: other, payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
    expect(run.state.cards[card]?.host).toBe(other);
  });
});

describe("Celebrían's Stone (01027:A:3)", () => {
  // "If attached hero is Aragorn, he also gains a Spirit resource icon.": Aragorn pays for Wandering Took (Spirit, cost 2) alone;
  // the Stone on Théodred (Leadership) gives him no Spirit icon.
  lineSpec("01027:A:3", "Celebrían's Stone: Aragorn gains a Spirit resource icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }], attached: [{ code: STONE, host: ARAGORN }], hand: [{ code: TOOK, seat: 0 }] }, 2);
    const took = idsOf(tab, TOOK);
    expect(refusal(tab.state, { type: "PlayCard", cardId: took, payments: [{ heroId: idsOf(tab, ARAGORN), amount: 2 }] }, tab.ctx)).toBeNull();
    const run = send(begin(tab.state), { type: "PlayCard", cardId: took, payments: [{ heroId: idsOf(tab, ARAGORN), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[took]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(0);
    const other = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }], attached: [{ code: STONE, host: THEODRED }], hand: [{ code: TOOK, seat: 0 }] }, 2);
    expect(refusal(other.state, { type: "PlayCard", cardId: idsOf(other, TOOK), payments: [{ heroId: idsOf(other, THEODRED), amount: 2 }] }, other.ctx)).toBe("No hero matches that card's sphere");
  });
});

describe("Stat lines (01040:A:2, 01041:A:2, 01055:A:2, 01071:A:1)", () => {
  // "Attached hero gets +4 Hit Points."
  lineSpec("01040:A:2", "Citadel Plate: attached hero gets +4 Hit Points", (effects) => {
    const tab = onHero(effects, PLATE, [GIMLI, LEGOLAS]);
    expect(stat(tab.state, tab, idsOf(tab, GIMLI), "hitPoints")).toBe(printed(tab, GIMLI, "health") + 4);
    expect(stat(tab.state, tab, idsOf(tab, LEGOLAS), "hitPoints")).toBe(printed(tab, LEGOLAS, "health"));
  });

  // "Attached hero gains +1 Attack. (+2 Attack instead if attached hero is a Dwarf.)": Legolas +1, Gimli (Dwarf) +2, not +3.
  lineSpec("01041:A:2", "Dwarven Axe: +1 Attack, +2 instead on a Dwarf", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: THALIN, seat: 0 }], attached: [{ code: AXE, host: GIMLI }, { code: AXE, host: LEGOLAS }] });
    expect(stat(tab.state, tab, idsOf(tab, GIMLI), "attack")).toBe(printed(tab, GIMLI, "attack") + 2);
    expect(stat(tab.state, tab, idsOf(tab, LEGOLAS), "attack")).toBe(printed(tab, LEGOLAS, "attack") + 1);
    expect(stat(tab.state, tab, idsOf(tab, THALIN), "attack")).toBe(printed(tab, THALIN, "attack"));
  });

  // "Attached hero gains +1 Willpower."
  lineSpec("01055:A:2", "The Favor of the Lady: attached hero gains +1 Willpower", (effects) => {
    const tab = onHero(effects, FAVOR, [EOWYN, ARAGORN]);
    expect(stat(tab.state, tab, idsOf(tab, EOWYN), "willpower")).toBe(printed(tab, EOWYN, "willpower") + 1);
    expect(stat(tab.state, tab, idsOf(tab, ARAGORN), "willpower")).toBe(printed(tab, ARAGORN, "willpower"));
  });

  // "Attach to a hero. Attached hero gets -1 Willpower.": both clauses are one line.
  lineSpec("01071:A:1", "Dark Knowledge: Attach to a hero; attached hero gets -1 Willpower", (effects) => {
    heroOnly(effects, DARK, DENETHOR);
    const tab = onHero(effects, DARK, [DENETHOR, ARAGORN]);
    expect(stat(tab.state, tab, idsOf(tab, DENETHOR), "willpower")).toBe(printed(tab, DENETHOR, "willpower") - 1);
    expect(stat(tab.state, tab, idsOf(tab, ARAGORN), "willpower")).toBe(printed(tab, ARAGORN, "willpower"));
  });
});

describe("Power in the Earth (01056)", () => {
  // "Attach to a location.": the location in the staging area and the active location are offered, no character is.
  lineSpec("01056:A:1", "Power in the Earth: Attach to a location", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], staging: [BAMFURLONG], active: GREEN_HILL, engaged: [{ code: ORC, seat: 0 }], hand: [{ code: POWER, seat: 0 }] });
    expect(hosts(tab, POWER)).toEqual([idsOf(tab, BAMFURLONG), idsOf(tab, GREEN_HILL)].sort());
    const card = idsOf(tab, POWER);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: card, hostId: idsOf(tab, BAMFURLONG), payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
    expect(run.state.cards[card]?.host).toBe(idsOf(tab, BAMFURLONG));
  });

  // "Attached location gets -1 Threat.": the staging area's total Threat falls by 1 with it, the other location keeps its own.
  lineSpec("01056:A:2", "Power in the Earth: attached location gets -1 Threat", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], staging: [BAMFURLONG, GREEN_HILL], hand: [{ code: POWER, seat: 0 }] });
    const before = stagingThreat(tab.state, tab.ctx.cards);
    const card = idsOf(tab, POWER);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: card, hostId: idsOf(tab, BAMFURLONG), payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
    expect(stat(run.state, tab, idsOf(tab, BAMFURLONG), "threat")).toBe((tab.ctx.cards.get(BAMFURLONG)?.threat ?? 0) - 1);
    expect(stat(run.state, tab, idsOf(tab, GREEN_HILL), "threat")).toBe(tab.ctx.cards.get(GREEN_HILL)?.threat ?? 0);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(before - 1);
  });
});

function combat(state: ScenarioState, tab: Table): Run {
  return begin(settle({ ...withMode(state, "combatStart"), window: null }, tab.ctx, []));
}

describe("Forest Snare (01069)", () => {
  // "Attach to an enemy engaged with a player.": an enemy engaged with either player is offered; one in the staging area is not.
  lineSpec("01069:A:1", "Forest Snare: Attach to an enemy engaged with a player", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], engaged: [{ code: ORC, seat: 0 }, { code: ORC, seat: 1 }], staging: [ORC], hand: [{ code: SNARE, seat: 0 }] });
    // The scene spawns the staging area before the engaged enemies.
    const [staged, mine, theirs] = tab.ids[ORC] ?? [];
    expect(hosts(tab, SNARE)).toEqual([mine ?? "", theirs ?? ""].sort());
    const card = idsOf(tab, SNARE);
    expect(refusal(tab.state, { type: "PlayCard", cardId: card, hostId: staged ?? "", payments: payFor(tab.state, tab.ctx, card) }, tab.ctx)).toBe("That host is illegal");
  });

  // "Attached enemy cannot attack.": in the combat phase the snared enemy makes no attack, so no defender is asked for and the
  // hero takes no damage.
  lineSpec("01069:A:2", "Forest Snare: attached enemy cannot attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], engaged: [{ code: ORC, seat: 0 }], hand: [{ code: SNARE, seat: 0 }] });
    const orc = idsOf(tab, ORC);
    const card = idsOf(tab, SNARE);
    const played = send(begin(tab.state), { type: "PlayCard", cardId: card, hostId: orc, payments: payFor(tab.state, tab.ctx, card) }, tab.ctx);
    expect(attackBarred(played.state, orc, 0)).toBe(true);
    const run = passWindows(combat(played.state, tab), tab.ctx);
    expect(run.state.window?.kind).not.toBe("defense");
    expect(run.steps.some((step) => step.kind === "strike" && step.side === "enemy")).toBe(false);
  });
});

describe("Thicket of Spears (01036:A:2)", () => {
  const three = (tab: Table) => [GIMLI, LEGOLAS, THALIN].map((code) => ({ heroId: idsOf(tab, code), amount: 1 }));

  // "Action: Choose a player. That player's engaged enemies cannot attack that player this phase.": played in the combat phase,
  // the enemy engaged with the player makes no attack; no defender is asked for and no hero takes damage.
  lineSpec("01036:A:2", "Thicket of Spears: the chosen player's engaged enemies cannot attack that player this phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: THALIN, seat: 0 }], engaged: [{ code: ORC, seat: 0 }], hand: [{ code: THICKET, seat: 0 }] }, 1);
    let run = combat(tab.state, tab);
    expect(run.state.window?.kind).toBe("frameAction");
    run = send(run, { type: "PlayCard", cardId: idsOf(tab, THICKET), payments: three(tab) }, tab.ctx);
    run = passWindows(run, tab.ctx);
    expect(run.state.window?.kind).not.toBe("defense");
    expect(run.steps.some((step) => step.kind === "strike" && step.side === "enemy")).toBe(false);
  });

  // In a two-player game the chosen player's enemies are barred and the other player's are not; the bar ends with the phase.
  lineSpec("01036:A:2", "Thicket of Spears: only the chosen player, only this phase", (effects) => {
    const heroes = [GIMLI, LEGOLAS, THALIN].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { seats: 2, heroes: [...heroes, { code: PAL, seat: 1 }], engaged: [{ code: ORC, seat: 0 }, { code: ORC, seat: 1 }], hand: [{ code: THICKET, seat: 0 }] }, 1);
    const [mine, theirs] = tab.ids[ORC] ?? [];
    let run = send(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, THICKET), payments: three(tab) }, tab.ctx);
    const players = legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
    expect(players).toHaveLength(2);
    run = send(run, { type: "Choose", optionId: players[1] ?? "" }, tab.ctx);
    expect(attackBarred(run.state, theirs ?? "", 1)).toBe(true);
    expect(attackBarred(run.state, mine ?? "", 0)).toBe(false);
    expect(attackBarred(withMode(run.state, "questCommit"), theirs ?? "", 1)).toBe(false);
  });
});

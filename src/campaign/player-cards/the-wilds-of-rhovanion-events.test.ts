// Rules: rr.step-2-2, rr.response, rr.step-6-4-1, rr.step-6-8-2, rr.modifiers, rr.attachment-cards (data/rules/entries.json).
// The Wilds of Rhovanion events, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// 18012:A:1, 18013:A:1, 18014:A:1, 18015:A:1 (the lines of data/cards/TWoR.json).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { playCost } from "../../rules/player/attach.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, combat, passAll, play, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "01001";
const GIMLI = "01004";
const EOWYN = "01007";
const DENETHOR = "01010";
const STEWARD = "01026";
const STONE = "01027";
const PLATE = "01040";
const COURAGE = "01057";
const BRAND = "18001";
const BARD = "18002";
const WARRIOR = "18005";
const HAUBERK = "18007";
const BOW = "18009";
const TRAFFIC = "18012";
const TO_ARMS = "18013";
const VALOUR = "18014";
const BARTERING = "18015";
const SNARE = "01069";
const POWER = "01056";
// Caught in a Web: an encounter treachery that attaches itself to a hero.
const WEB = "01080";
const GREEN_HILL = "141036";
const ORC = "orc";
const ALLY = "ally";
const PAL = "pal";
// A player attachment with no text, to put on an enemy.
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, GIMLI, EOWYN, DENETHOR, STEWARD, STONE, PLATE, COURAGE, BRAND, BARD, WARRIOR, HAUBERK, BOW, TRAFFIC, TO_ARMS, VALOUR, BARTERING, SNARE, POWER, GREEN_HILL, WEB];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(ORC, definePrinted({ code: ORC, name: "Orc", type: "enemy", traits: ["Orc"], threat: 1, engagementCost: 40, attack: 3, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

function playable(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));
}

describe("Traffic from Dale (18012:A:1)", () => {
  // "Planning Action: Choose a Dale hero you control. Add 1 resource to its pool for each character you control with a player
  // attachment. You can only play 1 copy of Traffic from Dale each round.": Bard (Hauberk), Aragorn (Citadel Plate) and a Warrior of
  // Dale (Bow) make 3; the other player's Warrior of Dale with a Bow does not count. Bard and Brand are offered, Aragorn (not Dale) is
  // not. The second copy is not offered that round, nor is the card in the combat phase.
  lineSpec("18012:A:1", "Traffic from Dale: a resource for each character you control with a player attachment, 1 copy a round", (effects) => {
    const scene = table(effects, {
      seats: 2,
      heroes: [{ code: BRAND, seat: 0 }, { code: BARD, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }],
      attached: [{ code: HAUBERK, host: BARD }, { code: PLATE, host: ARAGORN }],
      allies: [{ code: WARRIOR, seat: 0 }, { code: WARRIOR, seat: 1 }, { code: BOW, seat: 0 }, { code: BOW, seat: 1 }],
      hand: [{ code: TRAFFIC, seat: 0 }, { code: TRAFFIC, seat: 0 }],
    }, 1);
    const [mine, theirs] = scene.ids[WARRIOR] ?? [];
    const [bow, other] = scene.ids[BOW] ?? [];
    const tab = attach(scene, [[bow ?? "", mine ?? ""], [other ?? "", theirs ?? ""]]);
    const [first, second] = tab.ids[TRAFFIC] ?? [];
    const bard = idsOf(tab, BARD);
    expect(playable(combat(tab.state, tab).state, tab)).not.toContain(first);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: first ?? "", payments: [{ heroId: idsOf(tab, BRAND), amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, BRAND), bard].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: bard }, tab.ctx);
    expect(run.state.cards[bard]?.resources).toBe(1 + 3);
    expect(playable(run.state, tab)).not.toContain(second);
  });
});

describe("To Arms! (18013:A:1)", () => {
  // "Action: Choose an ally with a player attachment. Ready that ally.": the exhausted Warrior of Dale with a Bow is readied; the
  // exhausted ally without an attachment and the exhausted hero with Citadel Plate are not offered.
  lineSpec("18013:A:1", "To Arms!: ready an ally with a player attachment", (effects) => {
    const scene = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: PLATE, host: ARAGORN }], allies: [{ code: WARRIOR, seat: 0 }, { code: ALLY, seat: 0 }, { code: BOW, seat: 0 }], hand: [{ code: TO_ARMS, seat: 0 }] });
    const [warrior, ally, aragorn] = [idsOf(scene, WARRIOR), idsOf(scene, ALLY), idsOf(scene, ARAGORN)];
    const attached = attach(scene, [[idsOf(scene, BOW), warrior]]);
    let state = attached.state;
    for (const id of [warrior, ally, aragorn]) state = updateCard(state, id, { exhausted: true });
    const tab = { ...attached, state };
    let run = play(begin(tab.state), tab, idsOf(tab, TO_ARMS));
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[warrior]?.exhausted).toBe(false);
    expect(run.state.cards[ally]?.exhausted).toBe(true);
    expect(run.state.cards[aragorn]?.exhausted).toBe(true);
  });
});

describe("Valour of the North (18014:A:1)", () => {
  const attacking = (state: ScenarioState): ScenarioState => ({ ...withMode(state, "playerAttacks"), window: { kind: "playerAttack" }, activeSeat: 0 });
  // An Orc engaged with the player, with a player attachment on it.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: WARRIOR, seat: 0 }, { code: PLAIN, seat: 0 }], engaged: [{ code: ORC, seat: 0 }], hand: [{ code: VALOUR, seat: 0 }] });
    return attach(tab, [[idsOf(tab, PLAIN), idsOf(tab, ORC)]]);
  }
  const strikes = (run: Run, side: "player" | "enemy") => run.steps.flatMap((entry) => (entry.kind === "strike" && entry.side === side ? [entry] : []));

  // "Response: After a character is declared as an attacker ... against an enemy with an attachment, that character gets +3 Attack and
  // +3 Defense until the end of this attack.": the Warrior of Dale strikes with its printed Attack +3.
  lineSpec("18014:A:1", "Valour of the North: +3 Attack and +3 Defense for an attacker against an enemy with an attachment", (effects) => {
    const tab = scene(effects);
    const warrior = idsOf(tab, WARRIOR);
    const valour = idsOf(tab, VALOUR);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, ORC), attackerIds: [warrior] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("18014:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: valour, effectId: "18014:response:1", payments: payFor(run.state, tab.ctx, valour) }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(strikes(run, "player").map((strike) => strike.attack)).toEqual([(tab.ctx.cards.get(WARRIOR)?.attack ?? 0) + 3]);
    // The bonus ends with the attack.
    const after = run.state.cards[warrior];
    expect(after ? modifiedStat(run.state, after, "attack", tab.ctx.cards) : -1).toBe(tab.ctx.cards.get(WARRIOR)?.attack ?? 0);
  });

  // "... or defender against an enemy with an attachment ...": Gimli defends the Orc (Attack 3) with his printed Defense +3, so he
  // takes no damage.
  lineSpec("18014:A:1", "Valour of the North: +3 Attack and +3 Defense for a defender against an enemy with an attachment", (effects) => {
    const tab = scene(effects);
    const gimli = idsOf(tab, GIMLI);
    const valour = idsOf(tab, VALOUR);
    let run = passAll(combat(tab.state, tab), tab.ctx, { responses: true });
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: gimli }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("18014:response:2");
    run = sendUnledgered(run, { type: "Trigger", cardId: valour, effectId: "18014:response:2", payments: payFor(run.state, tab.ctx, valour) }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(strikes(run, "enemy").map((strike) => strike.defense)).toEqual([(tab.ctx.cards.get(GIMLI)?.defense ?? 0) + 3]);
    expect(run.state.cards[gimli]?.damage).toBe(0);
  });

  // Against an enemy without an attachment the Response is not offered.
  lineSpec("18014:A:1", "Valour of the North: not offered against an enemy without an attachment", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: WARRIOR, seat: 0 }], engaged: [{ code: ORC, seat: 0 }], hand: [{ code: VALOUR, seat: 0 }] });
    const marked = scene(effects);
    const bare = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, ORC), attackerIds: [idsOf(tab, WARRIOR)] }, tab.ctx);
    expect(triggers(bare.state, tab)).not.toContain("18014:response:1");
    const run = sendUnledgered(begin(attacking(marked.state)), { type: "DeclareAttackers", enemyId: idsOf(marked, ORC), attackerIds: [idsOf(marked, WARRIOR)] }, marked.ctx);
    expect(triggers(run.state, marked)).toContain("18014:response:1");
  });
});

describe("Bartering (18015:A:1)", () => {
  // "Planning Action: Choose a ready player attachment on a character you control. Return that attachment to its owner's hand to reduce
  // the cost of the next attachment played this phase by X, where [X] is the chosen attachment's cost.": the ready Steward of Gondor
  // (cost 2) goes back to the hand, the exhausted Unexpected Courage is not offered, and Celebrían's Stone (cost 2) then costs 0;
  // the attachment after it costs its printed cost again.
  lineSpec("18015:A:1", "Bartering: return a ready attachment to reduce the next attachment's cost by its cost", (effects) => {
    const scene = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: STEWARD, host: ARAGORN }, { code: COURAGE, host: DENETHOR }], hand: [{ code: BARTERING, seat: 0 }, { code: STONE, seat: 0 }] }, 0);
    const [steward, courage, stone, aragorn] = [idsOf(scene, STEWARD), idsOf(scene, COURAGE), idsOf(scene, STONE), idsOf(scene, ARAGORN)];
    const tab = { ...scene, state: updateCard(scene.state, courage, { exhausted: true }) };
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, BARTERING), payments: [] }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[steward]?.zone).toBe("hand");
    expect(run.state.cards[aragorn]?.attachments).toEqual([]);
    expect(playCost(run.state, stone, 0, tab.ctx, aragorn)).toBe(0);
    run = sendUnledgered(run, { type: "PlayCard", cardId: stone, hostId: aragorn, payments: [] }, tab.ctx);
    expect(run.state.cards[stone]?.host).toBe(aragorn);
    expect(playCost(run.state, steward, 0, tab.ctx, aragorn)).toBe(tab.ctx.cards.get(STEWARD)?.cost ?? 0);
  });

  // With a ready Forest Snare on an engaged enemy, a ready Power in the Earth on a location and Caught in a Web (an encounter card, not a player attachment) on Aragorn,
  // Bartering offers only the Steward of Gondor on Aragorn.
  it("18015:A:1 Bartering: an attachment on an enemy or a location, or an encounter card, is not a player attachment on a character you control", () => {
    const build = (steward: boolean): Table => {
      const scene = table(EFFECTS, {
        heroes: [{ code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }],
        attached: steward ? [{ code: STEWARD, host: ARAGORN }] : [],
        allies: [{ code: SNARE, seat: 0 }, { code: POWER, seat: 0 }],
        engaged: [{ code: ORC, seat: 0 }],
        staging: [GREEN_HILL],
        hand: [{ code: BARTERING, seat: 0 }],
      }, 0);
      const web = spawn(scene.state, WEB, { zone: "attached" });
      const webbed = { ...scene, state: attachTo(updateCard(web.state, web.id, { face: "up", controller: null }), web.id, idsOf(scene, ARAGORN)) };
      return attach(webbed, [[idsOf(scene, SNARE), idsOf(scene, ORC)], [idsOf(scene, POWER), idsOf(scene, GREEN_HILL)]]);
    };
    const tab = build(true);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, BARTERING), payments: [] }, tab.ctx);
    // One candidate: it is picked without a question, and the Snare and the Power stay attached.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, STEWARD)]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, SNARE)]?.host).toBe(idsOf(tab, ORC));
    expect(run.state.cards[idsOf(tab, POWER)]?.host).toBe(idsOf(tab, GREEN_HILL));
    const web = Object.values(tab.state.cards).find((card) => card.code === WEB);
    expect(run.state.cards[web?.id ?? ""]?.host).toBe(idsOf(tab, ARAGORN));
    const bare = build(false);
    expect(playable(bare.state, bare)).not.toContain(idsOf(bare, BARTERING));
  });
});

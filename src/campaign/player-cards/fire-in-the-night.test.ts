// Rules: rr.modifiers, rr.active-location, rr.attachment-cards, rr.action, rr.response, rr.limits, rr.lasting-effects, rr.enters-play,
// rr.cancel, rr.shadow-effects, rr.step-6-4-1, rr.step-6-8-2, rr.discard-pile-and-victory-display (data/rules/entries.json).
// The Fire in the Night allies and event, written from their card text (data/cards/FitN.json; data/printed holds no ledger for these
// cards yet): Forest Road Traveler 19059:A:1, Giant Bear 19061:A:1 and A:2, Galion 19063:A:1 and A:2, Quicker Than Sight 19064:A:1,
// Thalion 19065:A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { flagIcons } from "../../rules/families/costs/pay.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalTargets } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, combat, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const TRAVELER = "19059";
const BEAR = "19061";
const GALION = "19063";
const QUICKER = "19064";
const THALION = "19065";
// Squire's Helm: "Attach to an ally."; Power in the Earth (Spirit): "Attach to a location."
const HELM = "19003";
const POWER = "01056";
// Lórien Guide: a Silvan ally. The Black Rider of scenario 1, and Green Hill Country (Shadow: +1 Attack) for its shadow card.
const GUIDE = "01044";
const RIDER = "141039";
const GREEN_HILL = "141036";
// Player side quests: Scout Ahead (Lore), Send for Aid (Leadership); an encounter side quest, Mysterious Omens.
const SCOUT_AHEAD = "10009";
const SEND_FOR_AID = "10086";
const OMENS = "10160";
const ALLY = "ally";
const PLAIN = "plain";
// A Spirit hero with no text, to pay and to defend.
const SPIRIT = "spirit-hero";
const TOUGH = "tough";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([TRAVELER, BEAR, GALION, QUICKER, THALION, HELM, POWER, GUIDE, RIDER, GREEN_HILL, SCOUT_AHEAD, SEND_FOR_AID, OMENS]))]);
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 9, willpower: 2, attack: 1, defense: 2, health: 6 }));
  cards.set(TOUGH, definePrinted({ code: TOUGH, name: "Tough", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 20 }));
  base = { ...starter, cards };
});

const printed = (tab: Table, code: string, which: "attack" | "defense" | "willpower"): number => tab.ctx.cards.get(code)?.[which] ?? 0;

describe("Forest Road Traveler (19059:A:1)", () => {
  // "Forest Road Traveler gets +1 Willpower, +1 Attack, and +1 Defense for each attachment on the active location.": the active location
  // holds a plain attachment; Power in the Earth played on it from the hand makes 2, and the Traveler gets +2 of each in the state
  // that intent returns. Power in the Earth on a location in the staging area adds nothing.
  lineSpec("19059:A:1", "+1 Willpower, Attack and Defense for each attachment on the active location", (effects) => {
    const scene = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: TRAVELER, seat: 0 }, { code: PLAIN, seat: 0 }], active: GREEN_HILL, staging: [GREEN_HILL], hand: [{ code: POWER, seat: 0 }, { code: POWER, seat: 0 }] });
    const [staged, active] = scene.ids[GREEN_HILL] ?? [];
    const tab = { ...scene, state: syncConstants(attachTo(scene.state, idsOf(scene, PLAIN), active ?? ""), scene.ctx) };
    const traveler = idsOf(tab, TRAVELER);
    const [first, second] = tab.ids[POWER] ?? [];
    const all = (state: Table["state"]) => (["willpower", "attack", "defense"] as const).map((which) => stat(state, tab, traveler, which) - printed(tab, TRAVELER, which));
    expect(all(tab.state)).toEqual([1, 1, 1]);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: first ?? "", hostId: active, payments: payFor(tab.state, tab.ctx, first ?? "") }, tab.ctx);
    expect(all(run.state)).toEqual([2, 2, 2]);
    run = sendUnledgered(run, { type: "PlayCard", cardId: second ?? "", hostId: staged, payments: payFor(run.state, tab.ctx, second ?? "") }, tab.ctx);
    expect(all(run.state)).toEqual([2, 2, 2]);
  });

  it("19059:A:1 keeps his printed stats with no active location", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: TRAVELER, seat: 0 }], staging: [GREEN_HILL] });
    expect(stat(tab.state, tab, idsOf(tab, TRAVELER), "willpower")).toBe(printed(tab, TRAVELER, "willpower"));
  });
});

describe("Giant Bear (19061)", () => {
  // "Cannot have attachments.": Squire's Helm (Attach to an ally) is offered on the plain ally and not on the Bear.
  lineSpec("19061:A:1", "cannot have an attachment that another ally can", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: BEAR, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HELM, seat: 0 }] });
    expect([...legalTargets(tab.state, { type: "PlayCard", cardId: idsOf(tab, HELM) }, tab.ctx)]).toEqual([idsOf(tab, ALLY)]);
  });

  // "Action: Ready Giant Bear. At the end of the phase in which you triggered this effect, shuffle Giant Bear back into your deck.
  // (Limit once per phase.)": the exhausted Bear readies, is not offered again this phase, and the phase's end shuffles it into the deck.
  lineSpec("19061:A:2", "readies, once a phase, and is shuffled into the deck at the end of the phase", (effects) => {
    const scene = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: BEAR, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }] });
    const bear = idsOf(scene, BEAR);
    const tab = { ...scene, state: updateCard(scene.state, bear, { exhausted: true }) };
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: bear, effectId: "19061:action:1" }, tab.ctx);
    expect(run.state.cards[bear]).toMatchObject({ zone: "play", exhausted: false });
    run = { ...run, state: updateCard(run.state, bear, { exhausted: true }) };
    expect(triggers(run.state, tab)).not.toContain("19061:action:1");
    const cursor = run.state.seedCursor;
    const ended = settle({ ...withMode(run.state, "questCommit"), window: null }, tab.ctx, []);
    expect(ended.cards[bear]?.zone).toBe("deck");
    expect(ended.seats[0]?.deck).toHaveLength(3);
    expect(ended.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("Galion (19063)", () => {
  // "Cannot attack or defend.": in the defense window only the hero is offered, and in the player attack window Galion is not an attacker.
  lineSpec("19063:A:1", "is not offered as a defender or as an attacker", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: GALION, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }] });
    const galion = idsOf(tab, GALION);
    let run: Run = combat(tab.state, tab);
    for (let guard = 0; guard < 10 && run.state.window?.kind === "frameAction"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    expect(legalTargets(run.state, { type: "DeclareDefender" }, tab.ctx)).toEqual([idsOf(tab, SPIRIT)]);
    const attack = attacking(tab.state);
    expect(legalTargets(attack, { type: "DeclareAttackers", cardId: galion }, tab.ctx)).toEqual([]);
    expect(legalTargets(attack, { type: "DeclareAttackers", cardId: idsOf(tab, SPIRIT) }, tab.ctx)).toEqual([idsOf(tab, TOUGH)]);
  });

  // "Response: After Galion enters play, he gets +1 Willpower until the end of the round.": played from the hand, he has 1 Willpower
  // through the next phase and his printed 0 once the round ends.
  lineSpec("19063:A:2", "after he enters play, +1 Willpower until the end of the round", (effects) => {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], hand: [{ code: GALION, seat: 0 }] });
    const galion = idsOf(tab, GALION);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: galion, payments: payFor(tab.state, tab.ctx, galion) }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: galion, effectId: "19063:response:1" }, tab.ctx);
    expect(stat(run.state, tab, galion, "willpower")).toBe(printed(tab, GALION, "willpower") + 1);
    expect(stat(withMode(run.state, "questCommit"), tab, galion, "willpower")).toBe(printed(tab, GALION, "willpower") + 1);
    const round = settle({ ...withMode(run.state, "endRound"), window: null }, tab.ctx, []);
    expect(stat(round, tab, galion, "willpower")).toBe(printed(tab, GALION, "willpower"));
  });
});

describe("Quicker Than Sight (19064:A:1)", () => {
  // The Black Rider attacks with Green Hill Country (Shadow: +1 Attack) as its shadow card; the Spirit hero defends.
  function defended(effects: readonly Effect[], allies: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: allies.map((code) => ({ code, seat: 0 })), engaged: [{ code: RIDER, seat: 0 }], deck: [GREEN_HILL], hand: [{ code: QUICKER, seat: 0 }] });
    let run: Run = combat(tab.state, tab);
    const pass = (next: Run) => {
      let out = next;
      for (let guard = 0; guard < 10 && out.state.window?.kind === "frameAction"; guard += 1) out = sendUnledgered(out, { type: "Pass" }, tab.ctx);
      return out;
    };
    run = pass(run);
    expect(run.state.window?.kind).toBe("defense");
    return { tab, run: pass(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, SPIRIT) }, tab.ctx)) };
  }
  const damage = (run: Run, target: string): number => run.steps.flatMap((step) => (step.kind === "damage" && step.targetId === target ? [step.amount] : []))[0] ?? 0;

  // "Response: Return a Silvan ally you control to your hand to cancel a shadow effect just triggered during combat.": the Lórien Guide goes
  // back to the hand, the +1 Attack is canceled and the hero takes only the Rider's own Attack less his Defense.
  lineSpec("19064:A:1", "returns a Silvan ally to the hand to cancel the shadow effect", (effects) => {
    const { tab, run: pending } = defended(effects, [GUIDE, ALLY]);
    const event = idsOf(tab, QUICKER);
    expect(triggers(pending.state, tab)).toContain("19064:response:1");
    let run = sendUnledgered(pending, { type: "Trigger", cardId: event, effectId: "19064:response:1", payments: payFor(pending.state, tab.ctx, event) }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    for (let guard = 0; guard < 10 && (run.state.window?.kind === "frameAction" || run.state.window?.kind === "response"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, GUIDE)]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("play");
    expect(run.state.cards[event]?.zone).toBe("discard");
    expect(damage(run, idsOf(tab, SPIRIT))).toBe(printed(tab, RIDER, "attack") - printed(tab, SPIRIT, "defense"));
  });

  // Without a Silvan ally to return, the Response is not offered.
  it("19064:A:1 is not offered without a Silvan ally", () => {
    const { tab, run } = defended(EFFECTS, [ALLY]);
    expect(triggers(run.state, tab)).not.toContain("19064:response:1");
  });
});

describe("Thalion (19065:A:2)", () => {
  // Thalion in play and `quests` side quests in the victory display; a Pass in the planning phase brings the table up to date.
  function scene(effects: readonly Effect[], quests: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: THALION, seat: 0 }], victory: quests });
    return { tab, run: sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx) };
  }

  // "While there are at least 3 side quests in the victory display, Thalion loses the ally card type, gains the hero card type and the
  // resource icons of each sphere on a side quest in the victory display.": with Scout Ahead (Lore), Send for Aid (Leadership) and
  // Mysterious Omens (an encounter side quest) he is among the heroes with the Lore and Leadership icons, and no Spirit or Tactics icon.
  lineSpec("19065:A:2", "becomes a hero with the icons of the side quests' spheres while 3 side quests are in the victory display", (effects) => {
    const { tab, run } = scene(effects, [SCOUT_AHEAD, SEND_FOR_AID, OMENS]);
    const thalion = idsOf(tab, THALION);
    expect(run.state.cards[thalion]?.zone).toBe("heroes");
    expect(run.state.seats[0]?.heroes).toContain(thalion);
    expect(flagIcons(run.state, thalion).sort()).toEqual(["leadership", "lore"]);
  });

  it("19065:A:2 stays an ally with 2 side quests in the victory display", () => {
    const { tab, run } = scene(EFFECTS, [SCOUT_AHEAD, SEND_FOR_AID]);
    expect(run.state.cards[idsOf(tab, THALION)]?.zone).toBe("play");
    expect(flagIcons(run.state, idsOf(tab, THALION))).toEqual([]);
  });
});

// Rules: rr.attachment-cards, rr.character-cards, rr.location-cards, rr.staging-area, rr.active-location, rr.spheres-of-influence,
// rr.resource-match, rr.traits, rr.quest-phase, rr.step-3-5, rr.action, rr.cost, rr.ready, rr.lasting-effects, rr.unique-cards
// (data/rules/entries.json).
// The Grey Havens attachments, each line tested from the words on the card: Grappling Hook 11005:A:1, Mariner's Compass 11008:A:1, Explorer's
// Almanac 11011:A:1 and A:2, To the Sea, to the Sea! 11014:A:1, Narya 11015:A:1, A:2 and A:3. The lines are the text of data/cards/TGH.json
// (data/printed holds no entry for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, enter, hosts, passAll, play, playerTable, printed, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const CIRDAN = "11001";
const HOOK = "11005";
const COMPASS = "11008";
const ALMANAC = "11011";
const TO_THE_SEA = "11014";
const NARYA = "11015";
// Lindir: a unique Spirit Noldor ally.
const LINDIR = "10120";
// Core Aragorn (Leadership), Legolas (Tactics, Silvan), Glorfindel (Lore, Noldor), Denethor (Lore, Gondor), Gandalf (neutral ally).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const GLORFINDEL = "01011";
const DENETHOR = "01010";
const GANDALF = "01073";
// Snowbourn Scout (Leadership Scout ally, cost 1), Lórien Guide (Spirit Scout ally), Veteran Axehand (Tactics ally, not a Scout).
const SNOWBOURN = "01016";
const GUIDE = "01044";
const AXEHAND = "01028";
const WEAK = "weak";
// A location of 3 quest points and no threat.
const PLACE = "place";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [CIRDAN, HOOK, COMPASS, ALMANAC, TO_THE_SEA, NARYA, LINDIR, ARAGORN, LEGOLAS, GLORFINDEL, DENETHOR, GANDALF, SNOWBOURN, GUIDE, AXEHAND];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  cards.set(PLACE, definePrinted({ code: PLACE, name: "Place", type: "location", threat: 0, questPoints: 3 }));
  base = { ...starter, cards };
});

describe("Grappling Hook (11005:A:1)", () => {
  // "Attach to a character.": Legolas (a hero), the other player's hero and the Axehand (an ally) are offered; an engaged enemy and a location
  // are not.
  lineSpec("11005:A:1", "Grappling Hook: Attach to a character", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: AXEHAND, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], staging: [PLACE], hand: [{ code: HOOK, seat: 0 }] });
    const hook = idsOf(tab, HOOK);
    expect(hosts(tab, hook)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, PAL), idsOf(tab, AXEHAND)].sort());
    expect(play(begin(tab.state), tab, hook, idsOf(tab, AXEHAND)).state.cards[hook]?.host).toBe(idsOf(tab, AXEHAND));
  });
});

describe("Mariner's Compass (11008:A:1)", () => {
  // "Attach to a Leadership or a Scout character.": Aragorn (Leadership hero), the Snowbourn Scout (Leadership Scout) and the Lórien Guide
  // (Spirit Scout) are offered; Legolas (Tactics) and the Axehand (Tactics, not a Scout) are not.
  lineSpec("11008:A:1", "Mariner's Compass: Attach to a Leadership or a Scout character", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }, { code: GUIDE, seat: 0 }, { code: AXEHAND, seat: 0 }], hand: [{ code: COMPASS, seat: 0 }] });
    const compass = idsOf(tab, COMPASS);
    expect(hosts(tab, compass)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, SNOWBOURN), idsOf(tab, GUIDE)].sort());
    expect(play(begin(tab.state), tab, compass, idsOf(tab, GUIDE)).state.cards[compass]?.host).toBe(idsOf(tab, GUIDE));
  });
});

describe("Explorer's Almanac (11011:A:1, A:2)", () => {
  // "Attach to a location in the staging area.": the location in the staging area is offered, the active location and Denethor are not.
  lineSpec("11011:A:1", "Explorer's Almanac: Attach to a location in the staging area", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], staging: [PLACE], active: PLACE, hand: [{ code: ALMANAC, seat: 0 }] });
    const almanac = idsOf(tab, ALMANAC);
    const [staged = ""] = tab.ids[PLACE] ?? [];
    expect(hosts(tab, almanac)).toEqual([staged]);
    expect(play(begin(tab.state), tab, almanac, staged).state.cards[almanac]?.host).toBe(staged);
  });

  // "Progress from questing successfully may be placed on the attached location before it is placed on the current quest.": the Almanac is
  // played on the location in the staging area; Glorfindel (Willpower 3) and Denethor (1) quest against its 0 threat, and its 3 quest points
  // take 3 of the 4 progress before the quest gets the last 1.
  lineSpec("11011:A:2", "Explorer's Almanac: progress from questing goes on the attached location first", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: DENETHOR, seat: 0 }], staging: [PLACE], hand: [{ code: ALMANAC, seat: 0 }], deck: ["f0", "f0"] });
    const [place = ""] = tab.ids[PLACE] ?? [];
    const quest = Object.values(tab.state.cards).find((card) => card.zone === "questStage")?.id ?? "";
    const played = play(begin(tab.state), tab, idsOf(tab, ALMANAC), place);
    let run = sendUnledgered(begin(questing(played.state)), { type: "Commit", cardIds: [idsOf(tab, GLORFINDEL), idsOf(tab, DENETHOR)] }, tab.ctx);
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    // "may": the player is asked where the progress goes first.
    expect(choices(run.state, tab).sort()).toEqual(["location", "quest"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "location" }, tab.ctx);
    expect(run.state.cards[place]?.zone).not.toBe("staging");
    expect(run.state.cards[quest]?.progress).toBe(1);
  });

  // Without the Almanac every point of progress goes on the quest.
  it("11011:A:2 Explorer's Almanac: a location without it takes no progress from questing", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: GLORFINDEL, seat: 0 }, { code: DENETHOR, seat: 0 }], staging: [PLACE], deck: ["f0", "f0"] });
    const [place = ""] = tab.ids[PLACE] ?? [];
    const quest = Object.values(tab.state.cards).find((card) => card.zone === "questStage")?.id ?? "";
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, GLORFINDEL), idsOf(tab, DENETHOR)] }, tab.ctx);
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[place]?.progress ?? 0).toBe(0);
    expect(run.state.cards[quest]?.progress).toBe(4);
  });
});

describe("To the Sea, to the Sea! (11014:A:1)", () => {
  // "Attach to a Noldor character.": Círdan (Noldor hero, Spirit, who pays) and Lindir (Noldor ally) are offered; Legolas (Silvan) is not.
  lineSpec("11014:A:1", "To the Sea, to the Sea!: Attach to a Noldor character", (effects) => {
    const tab = table(effects, { heroes: [{ code: CIRDAN, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: LINDIR, seat: 0 }, { code: AXEHAND, seat: 0 }], hand: [{ code: TO_THE_SEA, seat: 0 }] });
    const song = idsOf(tab, TO_THE_SEA);
    expect(hosts(tab, song)).toEqual([idsOf(tab, CIRDAN), idsOf(tab, LINDIR)].sort());
    expect(play(begin(tab.state), tab, song, idsOf(tab, LINDIR)).state.cards[song]?.host).toBe(idsOf(tab, LINDIR));
  });
});

describe("Narya (11015:A:1, A:2, A:3)", () => {
  // "Attach to Círdan the Shipwright or Gandalf.": Círdan and the Gandalf ally are offered; Glorfindel (Noldor) and Legolas are not.
  lineSpec("11015:A:1", "Narya: Attach to Círdan the Shipwright or Gandalf", (effects) => {
    const tab = table(effects, { heroes: [{ code: CIRDAN, seat: 0 }, { code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: GANDALF, seat: 0 }], hand: [{ code: NARYA, seat: 0 }] });
    const narya = idsOf(tab, NARYA);
    expect(hosts(tab, narya)).toEqual([idsOf(tab, CIRDAN), idsOf(tab, GANDALF)].sort());
    expect(play(begin(tab.state), tab, narya, idsOf(tab, GANDALF)).state.cards[narya]?.host).toBe(idsOf(tab, GANDALF));
  });

  // "Attached character gains a Leadership resource icon.": Círdan (Spirit) cannot pay for the Snowbourn Scout (Leadership) alone; once Narya is
  // played on him, he can.
  lineSpec("11015:A:2", "Narya: the attached character pays for a Leadership card", (effects) => {
    const tab = table(effects, { heroes: [{ code: CIRDAN, seat: 0 }], hand: [{ code: NARYA, seat: 0 }, { code: SNOWBOURN, seat: 0 }] });
    const [cirdan, scout] = [idsOf(tab, CIRDAN), idsOf(tab, SNOWBOURN)];
    const byCirdan = { type: "PlayCard", cardId: scout, payments: [{ heroId: cirdan, amount: 1 }] } as const;
    expect(refusal(tab.state, byCirdan, tab.ctx)).not.toBeNull();
    const run = play(begin(tab.state), tab, idsOf(tab, NARYA), cirdan);
    expect(refusal(run.state, byCirdan, tab.ctx)).toBeNull();
  });

  // Círdan with Narya; three exhausted allies, the third the other player's.
  function naryaScene(effects: readonly Effect[]): { tab: Table; cirdan: string; narya: string; allies: string[] } {
    const start = table(effects, { seats: 2, heroes: [{ code: CIRDAN, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: NARYA, host: CIRDAN }], allies: [{ code: AXEHAND, seat: 0 }, { code: GUIDE, seat: 0 }, { code: AXEHAND, seat: 1 }] });
    const allies = [...(start.ids[AXEHAND] ?? []).slice(0, 1), idsOf(start, GUIDE), (start.ids[AXEHAND] ?? [])[1] ?? ""];
    let state = start.state;
    for (const id of allies) state = updateCard(state, id, { exhausted: true });
    return { tab: { ...start, state }, cirdan: idsOf(start, CIRDAN), narya: idsOf(start, NARYA), allies };
  }

  // "Action: Exhaust Narya and attached character to choose and ready up to 2 allies. Each of those allies gets +1 Attack and +1 Defense until
  // the end of the phase.": Narya and Círdan exhaust; the first player's Axehand and the other player's Axehand ready with +1/+1, the Guide stays
  // exhausted; the bonus ends with the phase.
  lineSpec("11015:A:3", "Narya: exhaust it and Círdan to ready 2 allies with +1 Attack and +1 Defense until the end of the phase", (effects) => {
    const { tab, cirdan, narya, allies } = naryaScene(effects);
    const [first = "", guide = "", other = ""] = allies;
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: narya, effectId: "11015:action:1" }, tab.ctx);
    expect([run.state.cards[narya]?.exhausted, run.state.cards[cirdan]?.exhausted]).toEqual([true, true]);
    expect(choices(run.state, tab).sort()).toEqual([...allies].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["done", "second"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "second" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([guide, other].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: other }, tab.ctx);
    for (const id of [first, other]) {
      expect(run.state.cards[id]?.exhausted).toBe(false);
      expect([stat(run.state, tab, id, "attack"), stat(run.state, tab, id, "defense")]).toEqual([printed(tab, AXEHAND, "attack") + 1, printed(tab, AXEHAND, "defense") + 1]);
    }
    expect(run.state.cards[guide]?.exhausted).toBe(true);
    expect(stat(run.state, tab, guide, "attack")).toBe(printed(tab, GUIDE, "attack"));
    const later = enter(run.state, tab, "questCommit");
    expect(stat(later.state, tab, first, "attack")).toBe(printed(tab, AXEHAND, "attack"));
  });

  // "up to 2": the player may stop after one ally.
  it("11015:A:3 Narya: readies only 1 ally when the player is done after the first", () => {
    const { tab, narya, allies } = naryaScene(EFFECTS);
    const [first = "", guide = "", other = ""] = allies;
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: narya, effectId: "11015:action:1" }, tab.ctx);
    run = sendUnledgered(sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx), { type: "Choose", optionId: "done" }, tab.ctx);
    expect([run.state.cards[first]?.exhausted, run.state.cards[guide]?.exhausted, run.state.cards[other]?.exhausted]).toEqual([false, true, true]);
  });

  // An exhausted Círdan cannot pay the cost: no Action.
  it("11015:A:3 Narya: not offered while the attached character is exhausted", () => {
    const { tab, cirdan } = naryaScene(EFFECTS);
    expect(triggers(updateCard(tab.state, cirdan, { exhausted: true }), tab)).not.toContain("11015:action:1");
  });
});

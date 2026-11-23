// Rules: rr.attachment-cards, rr.forced, rr.step-0-1, rr.destroy, rr.limits (data/rules/entries.json).
// The Road Darkens player cards, written from their card text (data/cards/TRD.json) and the scan-read ledger
// (data/printed/fellowship-of-the-ring.json), so every intent goes through the harness's send: Galadriel 142003:A:1, Elrond 142005:A:1,
// Wizard Pipe 142009:A:1, Fellowship of the Ring 142010:A:1 and A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { FRODO, SAM, begin, idsOf, send, type Run, type Table } from "../../../test/harness/scene.ts";
import { attach, endRound, hosts, playerTableFor } from "../../../test/harness/player-table.ts";

const GALADRIEL = "142003";
const ELROND = "142005";
const PIPE = "142009";
const FELLOWSHIP = "142010";
// Gandalf (core) and Radagast (Journey to Rhosgobel): Istari allies.
const GANDALF = "01073";
const RADAGAST = "02059";
const WEAK = "weak";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GALADRIEL, ELROND, PIPE, FELLOWSHIP, GANDALF, RADAGAST]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 3 }));
  base = { ...starter, cards };
});

// The card `id` is destroyed (9 damage), and a Pass lets the game resolve what that set off.
const destroyed = (tab: Table, id: string): Run => send(begin(placeDamage(tab.state, id, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);

describe("Galadriel and Elrond (142003:A:1, 142005:A:1)", () => {
  // "At the end of the round, discard Galadriel from play." / "At the end of the round, discard Elrond from play.": at the end of the
  // round the card is discarded; another ally stays in play.
  for (const [line, code] of [["142003:A:1", GALADRIEL], ["142005:A:1", ELROND]] as const) {
    lineSpec(line, "discarded from play at the end of the round", (effects) => {
      const tab = table(effects, { ring: "ready", allies: [{ code, seat: 0 }, { code: ALLY, seat: 0 }] });
      const ended = endRound(tab.state, tab).state;
      expect(ended.cards[idsOf(tab, code)]?.zone).toBe("discard");
      expect(ended.cards[idsOf(tab, ALLY)]?.zone).toBe("play");
    });
  }
});

describe("Wizard Pipe (142009:A:1)", () => {
  // "Attach to an Istari character. Limit 1 per character.": Radagast; not Gandalf, who has a Pipe already, nor the heroes nor an ally
  // that is not Istari.
  lineSpec("142009:A:1", "Wizard Pipe: Attach to an Istari character, one per character", (effects) => {
    const scene = table(effects, { ring: "ready", allies: [{ code: GANDALF, seat: 0 }, { code: RADAGAST, seat: 0 }, { code: ALLY, seat: 0 }, { code: PIPE, seat: 0 }], hand: [{ code: PIPE, seat: 0 }] });
    const [worn = "", held = ""] = scene.ids[PIPE] ?? [];
    const tab = attach(scene, [[worn, idsOf(scene, GANDALF)]]);
    expect(hosts(tab, held)).toEqual([idsOf(tab, RADAGAST)]);
  });
});

describe("Fellowship of the Ring (142010:A:1, A:3)", () => {
  // "Attach to the Ring-bearer.": Frodo, who bears the One Ring; not Sam nor an ally. Played, it goes on him.
  lineSpec("142010:A:1", "Fellowship of the Ring: Attach to the Ring-bearer", (effects) => {
    const tab = table(effects, { ring: "ready", heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: FELLOWSHIP, seat: 0 }] });
    const fellowship = idsOf(tab, FELLOWSHIP);
    expect(hosts(tab, fellowship)).toEqual([idsOf(tab, FRODO)]);
    const run = send(begin(tab.state), { type: "PlayCard", cardId: fellowship, hostId: idsOf(tab, FRODO), payments: payFor(tab.state, tab.ctx, fellowship) }, tab.ctx);
    expect(run.state.cards[fellowship]?.host).toBe(idsOf(tab, FRODO));
  });

  // Fellowship on Frodo, an ally of the player, the other player's hero and a Weak enemy engaged.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { seats: 2, ring: "ready", heroes: [{ code: FRODO, seat: 0 }, { code: SAM, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 1 }, { code: FELLOWSHIP, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    return attach(tab, [[idsOf(tab, FELLOWSHIP), idsOf(tab, FRODO)]]);
  }

  // "Forced: After a character is destroyed, discard Fellowship of the Ring.": the other player's ally is destroyed and the Fellowship
  // is discarded.
  lineSpec("142010:A:3", "Fellowship of the Ring: discarded after a character is destroyed", (effects) => {
    const tab = scene(effects);
    const run = destroyed(tab, idsOf(tab, ALLY));
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, FELLOWSHIP)]?.zone).toBe("discard");
  });

  // An enemy destroyed is not a character: the Fellowship stays on Frodo.
  it("142010:A:3 Fellowship of the Ring: stays when an enemy is destroyed", () => {
    const tab = scene(EFFECTS);
    const run = destroyed(tab, idsOf(tab, WEAK));
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(run.state.cards[idsOf(tab, FELLOWSHIP)]).toMatchObject({ zone: "play", host: idsOf(tab, FRODO) });
  });
});

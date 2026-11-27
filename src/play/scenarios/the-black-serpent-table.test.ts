// Rules: rr.guarded, rr.engaged, hrd.side-quests (data/rules/entries.json); ledger lines 17106:A:1, 17091:A:1, 17093:A:2, 17094:A:1, 17101:A:3, 17102:A:2, 17104:A:1, 17107:B:2, 17108:A:1 (docs/scenarios/haradrim/the-black-serpent.md, Table).
// What the table says of The Black Serpent's pieces: a Harad objective lies in the staging area, hangs on an encounter card (an attachment of it), or is held by a hero (an attachment of the hero); The Black Serpent in the staging area
// is considered engaged with each player who holds one; Don't Let Them Escape! is a side quest in the staging area. The set-aside objectives lie out of play and draw nowhere. The engine decided each number; nothing here changes one.
// No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { consideredEngagedSeats } from "../../rules/core/engaged.ts";
import { claimedBy, idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { zoneSelector } from "../store/selectors.ts";

const BANNER = "17091";
const GARB = "17092";
const SERPENT = "17094";
const GUARD = "17095";
const SIDE_QUEST = "17104";
const at = (layout: Layout = {}) => tableFromLayout("the-black-serpent", { seats: 1, phase: "Quest", ...layout });
// An objective a hero holds, as the claim leaves it: zone attached, on the hero, faceup, controlled by the hero's player and claimed.
const claim = (state: ReturnType<typeof at>["state"], code: string, hero: string) => claimedBy(state, idOf(state, code), idOf(state, hero));
const attachedTo = (t: ReturnType<typeof at>, zone: "staging" | "play", code: string): string[] =>
  zoneSelector(zone, 0)(t.state).entries.find((entry) => entry.card.code === code)?.attached.map((card) => card.code) ?? [];

describe("the Harad objectives", () => {
  it("17091:A:1 draws an objective that lies in the staging area as a card of that zone", () => {
    const t = at({ staging: [BANNER] });
    expect(t.state.cards[idOf(t.state, BANNER)]?.zone).toBe("staging");
    expect(zoneSelector("staging", 0)(t.state).entries.map((entry) => entry.card.code)).toContain(BANNER);
  });

  it("17108:A:1 and 17101:A:3 draw an objective hung on an encounter card under it, as one attachment of that card", () => {
    const t = at({ staging: [SERPENT], attached: [{ code: GARB, to: SERPENT, encounter: true }] });
    expect(attachedTo(t, "staging", SERPENT)).toEqual([GARB]);
  });

  it("17106:A:1 and 17107:B:2 draw an objective a hero holds under that hero", () => {
    const t = at({ staging: [BANNER] });
    const held = { ...t, state: claim(t.state, BANNER, "dh1") };
    expect(held.state.cards[idOf(held.state, BANNER)]).toMatchObject({ zone: "attached", claimed: true });
    expect(attachedTo(held, "play", "dh1")).toEqual([BANNER]);
  });

  it("17106:A:1 draws no card of an objective that is set aside, out of play", () => {
    const t = at({ setAside: [BANNER] });
    const drawn = (["staging", "play"] as const).flatMap((zone) => zoneSelector(zone, 0)(t.state).entries.map((entry) => entry.card.code));
    expect(drawn).not.toContain(BANNER);
  });
});

describe("The Black Serpent", () => {
  const STATS = [["engagedWithClaimers", 1]] as const;
  it("17107:B:2 is considered engaged with the player who holds an objective, and with no one while none is held", () => {
    const layout = { staging: [SERPENT], modified: [{ code: SERPENT, from: SERPENT, stats: STATS }] } satisfies Layout;
    const none = at(layout);
    expect(consideredEngagedSeats(none.state, idOf(none.state, SERPENT), [0])).toEqual([]);
    const held = at({ ...layout, staging: [SERPENT, BANNER] });
    const claimed = claim(held.state, BANNER, "dh1");
    expect(consideredEngagedSeats(claimed, idOf(claimed, SERPENT), [0])).toEqual([0]);
    expect(zoneSelector("staging", 0)(claimed).entries.map((entry) => entry.card.code)).toContain(SERPENT);
  });
});

describe("Don't Let Them Escape!", () => {
  it("17104:A:1 lies in the staging area as a side quest card the table already draws, beside the other staged cards", () => {
    const t = at({ staging: [SIDE_QUEST, GUARD] });
    expect(zoneSelector("staging", 0)(t.state).entries.map((entry) => entry.card.code)).toEqual(expect.arrayContaining([SIDE_QUEST, GUARD]));
  });
});

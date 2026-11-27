// Rules: rr.attachment-cards, rr.ownership-and-control (data/rules/entries.json).
// The hosts an effect's PutIntoPlay offers a card with no "Attach to" record (the loot "play" option, the `unguarded` step of
// Guarded (X)): with no host filter, or a filter that does not say `control: "you"`, a character of any seat; with `control: "you"`,
// only the actor's own. The table has a character for seat 1 only, so a host on seat 1 shows the other seat was offered.
import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { idleScenario } from "../../core/test-fixture.ts";
import { spawn } from "../../core/zones.ts";
import { putAttachmentIntoPlay } from "./play.ts";
import { ATTACHMENT_CARDS, attachmentCtx } from "./fixture.ts";

const cards = new Map([...ATTACHMENT_CARDS, ["plain", definePrinted({ code: "plain", name: "Plain Charm", type: "attachment", sphere: "neutral", cost: 0, traits: ["Item"] })]]);
const ctx = { ...attachmentCtx([]), cards };
const focus = { seat: 0, sourceId: null };

function table(withOwnHero: boolean) {
  let state = idleScenario(2, "Planning");
  const theirs = spawn(state, "ranger", { zone: "heroes", seat: 1 });
  state = theirs.state;
  let mine: string | null = null;
  if (withOwnHero) {
    const made = spawn(state, "hobbit", { zone: "heroes", seat: 0 });
    state = made.state;
    mine = made.id;
  }
  const charm = spawn(state, "plain", { zone: "hand", seat: 0 });
  return { state: charm.state, charm: charm.id, theirs: theirs.id, mine };
}

describe("PutIntoPlay of an attachment with no \"Attach to\" record", () => {
  it("is offered another seat's character with no host filter", () => {
    const made = table(false);
    const placed = putAttachmentIntoPlay(made.state, { verb: "PutIntoPlay", card: "picked" }, made.charm, focus, ctx, []);
    expect(placed.cards[made.charm]).toMatchObject({ zone: "play", host: made.theirs });
  });

  it("is offered another seat's character with a host filter that names no seat", () => {
    const made = table(false);
    const placed = putAttachmentIntoPlay(made.state, { verb: "PutIntoPlay", card: "picked", host: { type: "hero", control: "any" } }, made.charm, focus, ctx, []);
    expect(placed.cards[made.charm]).toMatchObject({ zone: "play", host: made.theirs });
  });

  it("keeps only the actor's characters with `control: \"you\"`", () => {
    const alone = table(false);
    const refused = putAttachmentIntoPlay(alone.state, { verb: "PutIntoPlay", card: "picked", host: { type: "hero", control: "you" } }, alone.charm, focus, ctx, []);
    expect(refused.cards[alone.charm]?.zone).toBe("hand");
    const both = table(true);
    const placed = putAttachmentIntoPlay(both.state, { verb: "PutIntoPlay", card: "picked", host: { type: "hero", control: "you" } }, both.charm, focus, ctx, []);
    expect(placed.cards[both.charm]).toMatchObject({ zone: "play", host: both.mine });
  });
});

// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes (data/rules/entries.json). The three predicates of a character an encounter card holds share one test (held.ts, from the engine's heldHero): they differ only in the guarded flag, the hero slot, the
// prisoner mark and the face.
import { describe, expect, it } from "vitest";

import { heldHero, type CardInstance } from "../../rules/core/state.ts";

import { heldStrip, isHeldCharacter } from "./held.ts";

const card = (extra: Partial<CardInstance>): CardInstance => ({ id: "c", code: "x", zone: "captive", exhausted: false, damage: 0, progress: 0, resources: 0, host: "h", attachments: [], committed: false, shadowId: null, face: "up", controller: null, enteredPlay: 0, ...extra });

describe("the characters an encounter card holds", () => {
  const ally = card({ captive: true, owner: 0 });
  const abaan = card({ captive: true });
  const guarded = card({ guardedHero: true, owner: 0 });
  const captiveHero = card({ captive: true, heroSlot: 0, owner: 0 });
  const prisoner = card({ captive: true, prisoner: true });

  it("17119:A:1 counts a held ally and Abaan as held characters, a guarded hero and a Captive hero as heroes", () => {
    expect([ally, abaan].map(isHeldCharacter)).toEqual([true, true]);
    expect([guarded, captiveHero, prisoner].map(isHeldCharacter)).toEqual([false, false, false]);
  });

  it("17119:A:1 gives a strip to a held ally, Abaan and a guarded hero, not to a Captive hero, a prisoner or a card turned facedown", () => {
    expect([ally, abaan, guarded].map(heldStrip)).toEqual([true, true, true]);
    expect([captiveHero, prisoner, card({ captive: true, face: "down" }), card({ captive: true, host: null }), card({ captive: true, zone: "play" })].map(heldStrip)).toEqual([false, false, false, false, false]);
  });

  it("starts from the engine's heldHero: a card it does not hold is no held character", () => {
    for (const one of [card({}), card({ captive: true, zone: "play" })]) {
      expect(heldHero(one)).toBe(false);
      expect(isHeldCharacter(one) || heldStrip(one)).toBe(false);
    }
  });
});

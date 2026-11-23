// Rules: rr.in-play-and-out-of-play, rr.active-location, rr.defending-player, rr.engaged, rr.first-player, rr.damage, rr.shadow-effects, faq.additional-attacks, rr.discard-pile-and-victory-display (data/rules/entries.json); docs/scenarios/the-hobbit/over-the-misty-mountains-grim.md (Over the Misty Mountains Grim).
// Card specs for the Misty Mountain Goblins set (131058 to 131061, 131065, 131070: 131058:A:1, 131058:A:2, 131059:A:1, 131059:A:2, 131060:A:2, 131061:A:1, 131061:A:2, 131065:A:1, 131065:A:2, 131070:A:1, 131070:A:2), which Over the Misty Mountains Grim and
// Dungeons Deep and Caverns Dim both deal. They run on this scenario's table, as any scenario that deals the set could run them.
import { expect } from "vitest";

import { attack, cardSpecs, damageOn, defend, exhausted, reveal, resolve, stat, threat, zone, answer, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { startReveal } from "../../../rules/windows/frames.ts";

const ID = "over-the-misty-mountains-grim";
const AXEMAN = "131058";
const MINERS = "131059";
const RUNNERS = "131060";
const DRIVER = "131061";
const CAVES = "131065";
const PORCH = "131066";
const ROOM = "131067";
const ROCK = "131068";
const GRIP = "131070";

const ROWS: readonly Row[] = [
  { line: "131058:A:1", name: "Goblin Axeman gets +1 Attack for each Cave location in the staging area", layout: { stage: "131027", staging: [AXEMAN, PORCH, ROOM, ROCK] }, act: [], expect: [stat(AXEMAN, "attack", 3)] },
  { line: "131058:A:1", name: "and the Cave location that is the active location counts too", layout: { stage: "131027", staging: [AXEMAN], active: CAVES }, act: [], expect: [stat(AXEMAN, "attack", 2)] },
  { line: "131058:A:2", name: "Shadow: the defending character gets -1 Defense", layout: { stage: "131027", engaged: [RUNNERS], deck: ["f0", "f0", "f0"] }, act: [attack(RUNNERS, { shadow: AXEMAN }), defend("dh1")], expect: [damageOn("dh1", 2)] },
  { line: "131059:A:1", name: "Goblin Miners gets +1 Defense for each Cave location in the staging area", layout: { stage: "131027", staging: [MINERS, PORCH, ROOM, ROCK] }, act: [], expect: [stat(MINERS, "defense", 2)] },
  { line: "131059:A:1", name: "and the Cave location that is the active location counts too", layout: { stage: "131027", staging: [MINERS], active: CAVES }, act: [], expect: [stat(MINERS, "defense", 1)] },
  { line: "131059:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { stage: "131027", engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: MINERS, undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "131060:A:2", name: "Shadow: the attacking enemy makes an additional attack immediately after this one, with a new shadow card", layout: { stage: "131027", engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: RUNNERS, undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "131061:A:1", name: "When Revealed: the first player exhausts 1 character he controls", layout: { stage: "131027" }, act: [reveal(DRIVER), answer("dh2")], expect: [exhausted("dh2")] },
  { line: "131061:A:2", name: "Shadow: the defending player exhausts 1 character he controls", layout: { stage: "131027", engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: [attack("f3", { shadow: DRIVER, undefended: true }), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false)] },
  { line: "131065:A:1", name: "While The Goblins' Caves is the active location, Goblin enemies get +1 Threat", layout: { stage: "131027", staging: [AXEMAN], active: CAVES }, act: [], expect: [stat(AXEMAN, "threat", 3)] },
  { line: "131065:A:2", name: "Shadow: the defending player raises his threat by the Goblin enemies engaged with him", layout: { stage: "131027", threat: [30, 30], engaged: ["f3", AXEMAN, MINERS], deck: ["f0", "f0", "f0"] }, act: [attack("f3", { shadow: CAVES }), defend("dh1")], expect: [threat(32)] },
  { line: "131065:A:2", name: "Shadow: a Goblin enemy engaged with another player is not counted, and a second Goblin is counted again", layout: { stage: "131027", seats: 2, threat: [30, 30], engaged: ["f3", AXEMAN], deck: ["f0", "f0", "f0"] }, act: [attack("f3", { shadow: CAVES }), defend("dh1")], expect: [threat(31)] },
  { line: "131070:A:1", name: "When Revealed: the first player adds a Goblin enemy of the discard pile to the staging area", layout: { stage: "131027", discard: [AXEMAN, "f0"] }, act: resolve(GRIP, "whenRevealed"), expect: [zone(AXEMAN, "staging"), zone("f0", "encounterDiscard")] },
  { line: "131070:A:2", name: "Shadow: the defending player deals damage among his characters equal to the Goblin enemies engaged with him", layout: { stage: "131027", engaged: ["f3", AXEMAN, MINERS], deck: ["f0", "f0", "f0"] }, act: [attack("f3", { shadow: GRIP }), defend("dh1"), answer("dh2"), answer("dh2")], expect: [damageOn("dh2", 2)] },
];

cardSpecs(ID, ROWS);

// 131061:A:1 reads "the first player", not the player who revealed the card: the second player reveals it and the first player's character is the one that exhausts.
lineSpec("131061:A:1", "a card revealed by the second player exhausts a character of the first player", (effects) => {
  const made = tableFromLayout(ID, { stage: "131027", seats: 2 }, { effects });
  const steps: EngineStep[] = [];
  const spawned = spawn({ ...made.state, window: null, mode: "stopped" }, DRIVER, { zone: "encounterDeck" }, "down");
  const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
  const revealed = finish({ state: settle(startReveal(top, 1, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
  const exhaustedCodes = Object.values(revealed.cards).filter((card) => card.exhausted && card.zone === "heroes").map((card) => card.code);
  expect(exhaustedCodes).toHaveLength(1);
  expect(revealed.cards[idOf(revealed, exhaustedCodes[0]!)]?.controller ?? 0).toBe(0);
});

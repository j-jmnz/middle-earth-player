import { describe, expect, it } from "vitest";

import { loadLedger, printedLine } from "../../scripts/data/printed/ledger.ts";
import { EFFECTS } from "./index.ts";

// The templates write records for a few Haradrim lines at build time (src/effects/generated/haradrim.ts); the rest are the scenario authors' (src/effects/open-lines.ts). Each generated
// record is checked against the scan-read line it names: the line says what the record does, and the record does it.
const ledger = loadLedger();
const effectOf = (id: string) => EFFECTS.find((effect) => effect.id === id);
const attackPlusOne = { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" };

describe("Haradrim's generated records", () => {
  it.each([
    ["16018:travel:1", "16018:A:2", "Travel: Reveal the top card of the encounter deck to travel here.", [{ verb: "RevealEncounter" }]],
    ["16056:travel:1", "16056:A:2", "Travel: Reveal the top card of the encounter deck to travel here.", [{ verb: "RevealEncounter" }]],
    ["17069:travel:1", "17069:A:3", "Travel: Reveal the top card of the encounter deck to travel here.", [{ verb: "RevealEncounter" }]],
    ["16063:shadow:1", "16063:A:2", "Shadow: Return attacking enemy to the staging area after this attack.", [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }]],
    ["17151:shadow:1", "17151:A:2", "Shadow: Return attacking enemy to the staging area after this attack.", [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }]],
    ["17123:shadow:1", "17123:A:3", "Shadow: Attacking enemy gets +1 Attack.", [attackPlusOne]],
    [
      "17155:shadow:1",
      "17155:A:2",
      "Shadow: Attacking enemy gets +1 Attack. If this attack destroys a character, raise your threat by 2.",
      [attackPlusOne, { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 2, when: { kind: "x", min: 1 } }] }],
    ],
  ])("%s does what the printed line %s says", (id, line, text, instructions) => {
    expect(printedLine(ledger, line)).toBe(text);
    expect(effectOf(id)?.lines).toEqual([line]);
    expect(effectOf(id)?.instructions).toEqual(instructions);
  });

  it.each([
    ["17120:triggered:1", "17120:A:3", "If Abaan leaves play, the players lose the game."],
    ["17145:triggered:1", "17145:A:4", "If Poros Garrison leaves play, the players lose the game."],
  ])("%s loses the game when the card leaves play, as the printed line %s says", (id, line, text) => {
    expect(printedLine(ledger, line)).toBe(text);
    const effect = effectOf(id);
    expect(effect?.lines).toEqual([line]);
    expect(effect).toMatchObject({ timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "LoseGame" }] });
  });
});

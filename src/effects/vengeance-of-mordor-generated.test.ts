import { describe, expect, it } from "vitest";

import { loadLedger, printedLine } from "../../scripts/data/printed/ledger.ts";
import { EFFECTS } from "./index.ts";

// The templates write records for a few lines of the Vengeance of Mordor cycle at build time (src/effects/generated/vengeance-of-mordor.ts, and player-pool.ts for the player cards); the rest are the
// scenario authors' (src/effects/open-lines.ts). Each generated record is checked against the scan-read line it names: the line says what the record does, and the record does it.
const ledger = loadLedger();
const effectOf = (id: string) => EFFECTS.find((effect) => effect.id === id);

describe("Vengeance of Mordor's generated records", () => {
  it.each([
    ["21040:shadow:1", "21040:A:2", "Shadow: Attacking enemy gets +1 Attack.", [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }]],
    ["22151:shadow:1", "22151:A:3", "Shadow: Attacking enemy gets +2 Attack.", [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }]],
    ["22044:shadow:1", "22044:A:3", "Shadow: Return attacking enemy to the staging area after this attack.", [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }]],
    ["22151:constant:1", "22151:A:1", "Cannot have attachments.", [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" }]],
    ["22096:constant:1", "22096:A:1", "Cannot have attachments.", [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" }]],
    ["22039:constant:1", "22039:A:1", "Cannot have player card attachments.", [{ verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay" }]],
    ["22008:constant:1", "22008:A:1", "Attach to a Spirit hero. Limit 1 per hero.", [{ verb: "AttachesTo", host: { kind: "hero", sphere: "spirit" }, limitPerHost: true }]],
    ["22083:constant:1", "22083:A:1", "Attach to a Noble hero. Limit 1 per hero.", [{ verb: "AttachesTo", host: { kind: "hero", trait: "Noble" }, limitPerHost: true }]],
    ["22143:constant:1", "22143:A:1", "Attach to a Warrior character.", [{ verb: "AttachesTo", host: { kind: "character", trait: "Warrior" } }]],
  ])("%s does what the printed line %s says", (id, line, text, instructions) => {
    expect(printedLine(ledger, line)).toBe(text);
    expect(effectOf(id)?.lines).toEqual([line]);
    expect(effectOf(id)?.instructions).toEqual(instructions);
  });

  it.each([
    ["21001:triggered:1", "21001:A:4", "If The One Ring leaves play, the players lose the game."],
    ["22124:triggered:1", "22124:A:3", "If Edrahil leaves play, the players lose the game."],
    ["22125:triggered:1", "22125:A:3", "If Arador leaves play, the players lose the game."],
    ["22126:triggered:1", "22126:A:3", "If Farin leaves play, the players lose the game."],
  ])("%s loses the game when the card leaves play, as the printed line %s says", (id, line, text) => {
    expect(printedLine(ledger, line)).toBe(text);
    const effect = effectOf(id);
    expect(effect?.lines).toEqual([line]);
    expect(effect).toMatchObject({ timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "LoseGame" }] });
  });
});

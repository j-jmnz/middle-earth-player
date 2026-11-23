// Rules: rr.spheres-of-influence, rr.gains, rr.resource-match (data/rules/entries.json).
// A character that gains a resource icon belongs to that sphere as well, for the filters that read a sphere as for paying (docs/brief.md, Player card
// readings): a Lore hero for Healing Herbs 04109 ("Attach to a [lore] hero") once Song of Wisdom 02034 gives it the Lore icon, and a Leadership
// character for Mariner's Compass 11008 ("Attach to a [leadership] or a Scout character") once Narya 11015 gives it the Leadership icon, Círdan the
// Shipwright (a hero) and the Gandalf ally alike.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { idsOf } from "../../../test/harness/scene.ts";
import { attach, hosts, playerTable } from "../../../test/harness/player-table.ts";

const SONG = "02034";
const HERBS = "04109";
const NARYA = "11015";
const COMPASS = "11008";
const EOWYN = "01007";
const BERAVOR = "01012";
const CIRDAN = "11001";
const GANDALF = "01073";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([SONG, HERBS, NARYA, COMPASS, EOWYN, BERAVOR, CIRDAN, GANDALF]))]) };
});

describe("a gained resource icon in a sphere filter", () => {
  it("Song of Wisdom makes Éowyn a Lore hero: Healing Herbs may attach to her, and to Beravor, but not to her without the Song", () => {
    const plain = playerTable(base, EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: HERBS, seat: 0 }] });
    expect(hosts(plain, idsOf(plain, HERBS))).toEqual([idsOf(plain, BERAVOR)]);
    const scene = { heroes: [{ code: EOWYN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: HERBS, seat: 0 }], attached: [{ code: SONG, host: EOWYN }] };
    const sung = playerTable(base, EFFECTS, scene);
    expect(hosts(sung, idsOf(sung, HERBS))).toEqual([idsOf(sung, EOWYN), idsOf(sung, BERAVOR)].sort());
  });

  it("Narya's Leadership icon lets Mariner's Compass attach to Círdan (a hero) and to the Gandalf ally, and not without it", () => {
    const scene = { heroes: [{ code: CIRDAN, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: GANDALF, seat: 0 }], hand: [{ code: COMPASS, seat: 0 }] };
    const plain = playerTable(base, EFFECTS, scene);
    expect(hosts(plain, idsOf(plain, COMPASS))).toEqual([]);
    const onCirdan = playerTable(base, EFFECTS, { ...scene, attached: [{ code: NARYA, host: CIRDAN }] });
    expect(hosts(onCirdan, idsOf(onCirdan, COMPASS))).toEqual([idsOf(onCirdan, CIRDAN)]);
    // The scene puts the allies in play after it attaches, so Narya goes on Gandalf afterwards.
    const loose = playerTable(base, EFFECTS, { ...scene, allies: [...scene.allies, { code: NARYA, seat: 0 }] });
    const onGandalf = attach(loose, [[idsOf(loose, NARYA), idsOf(loose, GANDALF)]]);
    expect(hosts(onGandalf, idsOf(onGandalf, COMPASS))).toEqual([idsOf(onGandalf, GANDALF)]);
  });
});

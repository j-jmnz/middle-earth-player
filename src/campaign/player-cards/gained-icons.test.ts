// Rules: rr.spheres-of-influence, rr.gains, rr.resource-match (data/rules/entries.json).
// A character that gains a resource icon belongs to that sphere as well, for the filters that read a sphere as for paying (docs/brief.md, Three layers): a Lore hero for Healing Herbs 04109 ("Attach to a [lore] hero") once Song of Wisdom 02034 gives it the Lore icon, and a Leadership
// character for Mariner's Compass 11008 ("Attach to a [leadership] or a Scout character") once Narya 11015 gives it the Leadership icon, Círdan the
// Shipwright (a hero) and the Gandalf ally alike.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
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
const GROVE = "02046";
const HARDY = "04130";
const SCOUT = "01016";
const THORONGIL = "22146";
const FELLOWSHIP_ARAGORN = "145001";
const BILBO = "131001";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([SONG, HERBS, NARYA, COMPASS, EOWYN, BERAVOR, CIRDAN, GANDALF, GROVE, HARDY, SCOUT, THORONGIL, FELLOWSHIP_ARAGORN, BILBO]))]) };
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

// Oak-wood Grove (02046:A:1): "resource tokens from any sphere may be spent as Leadership resource tokens" lets a hero pay for a Leadership card; it
// gives no icon, so the hero is no Leadership hero for a card that reads a sphere.
describe("Oak-wood Grove as a payment allowance", () => {
  const scene = { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: SCOUT, seat: 0 }, { code: HARDY, seat: 0 }] };
  const playable = (tab: ReturnType<typeof playerTable>): string[] => legalIntents(tab.state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));

  it("a Leadership ally is paid with a Lore hero's resources while the Grove is active, and not without it", () => {
    const plain = playerTable(base, EFFECTS, scene);
    expect(playable(plain)).not.toContain(idsOf(plain, SCOUT));
    const grove = playerTable(base, EFFECTS, { ...scene, active: GROVE });
    expect(playable(grove)).toContain(idsOf(grove, SCOUT));
  });

  it("Hardy Leadership still cannot attach to a Lore hero while the Grove is active", () => {
    const grove = playerTable(base, EFFECTS, { ...scene, active: GROVE });
    expect(hosts(grove, idsOf(grove, HARDY))).toEqual([]);
  });
});

// Thorongil (22146:A:1) attaches to a non-Fellowship, non-Baggins hero: a gained icon does not make a Fellowship or Baggins hero pass.
describe("Thorongil and a hero that gained an icon", () => {
  it("a Fellowship hero with Song of Wisdom (a Lore icon) is still refused, and Beravor is the only host", () => {
    const heroes = [{ code: FELLOWSHIP_ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }];
    const plain = playerTable(base, EFFECTS, { heroes, hand: [{ code: THORONGIL, seat: 0 }] });
    expect(hosts(plain, idsOf(plain, THORONGIL))).toEqual([idsOf(plain, BERAVOR)]);
    const sung = playerTable(base, EFFECTS, { heroes, hand: [{ code: THORONGIL, seat: 0 }], attached: [{ code: SONG, host: FELLOWSHIP_ARAGORN }] });
    expect(hosts(sung, idsOf(sung, THORONGIL))).toEqual([idsOf(sung, BERAVOR)]);
  });

  it("a Baggins hero with Song of Wisdom is refused too", () => {
    const sung = playerTable(base, EFFECTS, { heroes: [{ code: BILBO, seat: 0 }], hand: [{ code: THORONGIL, seat: 0 }], attached: [{ code: SONG, host: BILBO }] });
    expect(hosts(sung, idsOf(sung, THORONGIL))).toEqual([]);
  });
});

// Haunted Valley (50321:A:1): a hero that lost its Lore, Leadership, Spirit and Tactics icons belongs to none of those spheres, a gained one included.
describe("a hero that lost its icons in a sphere filter", () => {
  it("Éowyn with Song of Wisdom is a Lore hero for Healing Herbs, and no longer once she lost her icons", () => {
    const scene = { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: HERBS, seat: 0 }], attached: [{ code: SONG, host: EOWYN }] };
    const sung = playerTable(base, EFFECTS, scene);
    expect(hosts(sung, idsOf(sung, HERBS))).toEqual([idsOf(sung, EOWYN)]);
    const hero = idsOf(sung, EOWYN);
    const lost = { ...sung.state, modifiers: [...sung.state.modifiers, { instanceId: hero, sourceId: hero, stat: "losesIcons" as const, amount: 1, until: "endOfRound" as const }] };
    expect(hosts(sung, idsOf(sung, HERBS), lost)).toEqual([]);
  });
});

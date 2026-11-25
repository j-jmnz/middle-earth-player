// The committed table moments (test/scenarios/<id>/screens.ts, test/harness/screens.ts) still build: each layout becomes a table in Node, the dump the page gets is plain JSON of that state, and the web's table store opens on it.
// No game is played and no browser opens. A card renamed, a zone gone or a scenario dropped fails here, naming the moment.
import { describe, expect, it } from "vitest";

import { createTableStore } from "../../src/play/store/store.ts";
import { openScene } from "../../src/screens/session/web/scene-dump.ts";
import { sceneTable } from "../game/scene-source.ts";
import { scenariosWithScreens, screensOf } from "../../test/harness/screens.ts";
import { momentShots, sceneDump } from "./scene.ts";

describe("committed screen moments", () => {
  const ids = scenariosWithScreens();

  it("are written for the scenarios that have a new widget", () => {
    expect(ids).toEqual(expect.arrayContaining(["assault-on-osgiliath", "the-blood-of-gondor", "the-morgul-vale"]));
  });

  for (const id of ids) {
    it(`${id}: every moment builds a table the web opens`, async () => {
      const moments = await screensOf(id);
      expect(moments.length, `${id} has a screens.ts with no moment`).toBeGreaterThan(0);
      const names = new Set<string>();
      for (const moment of moments) {
        expect(names.has(moment.name), `${id} names a moment ${moment.name} twice`).toBe(false);
        names.add(moment.name);
        expect(moment.note.length, `${id}/${moment.name} has no note`).toBeGreaterThan(20);
        const dump = sceneDump(id, moment.layout);
        // The state crosses as JSON: nothing in it may be lost on the way (a Map, a Set, a function).
        expect(dump.state, `${id}/${moment.name}`).toEqual(sceneTable(id, moment.layout).state);
        const opened = openScene(dump, () => new Map());
        expect(opened, `${id}/${moment.name} does not open`).not.toBeNull();
        if (!opened) continue;
        const store = createTableStore({ ctx: opened.ctx, game: opened.game });
        expect(store.getState().legal.length, `${id}/${moment.name} offers no intent`).toBeGreaterThan(0);
      }
    });
  }

  it("is named by --moment: one moment, or all of a scenario's", async () => {
    expect((await momentShots("the-morgul-vale")).map((shot) => shot.name)).toEqual(["the-morgul-vale-captain-bodyguard", "the-morgul-vale-to-the-tower-nine"]);
    expect((await momentShots("the-morgul-vale/to-the-tower-nine")).length).toBe(1);
    await expect(momentShots("the-morgul-vale/nope")).rejects.toThrow("captain-bodyguard");
    await expect(momentShots("the-thing-in-the-depths")).rejects.toThrow("screens.ts");
  });
});

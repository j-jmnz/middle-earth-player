// The web's audio players (web-audio.ts): a browser's refused loop is asked again once a gesture has given the page an activation, after the
// gesture's own handlers; a sound is not; the desktop waits for nothing; the window's blur pauses what sounds and its focus goes on.
import { describe, expect, it } from "vitest";

import { webAudio, type Media, type Page, type Player } from "./web-audio.ts";

function fakePage(): Page & { fire: (type: string) => void; flush: () => void; active: boolean; listening: () => string[] } {
  const handlers = new Map<string, Set<() => void>>();
  const queued: (() => void)[] = [];
  const page = {
    active: false,
    listen: (type: string, handler: () => void) => void handlers.set(type, (handlers.get(type) ?? new Set()).add(handler)),
    unlisten: (type: string, handler: () => void) => void handlers.get(type)?.delete(handler),
    activated: () => page.active,
    later: (run: () => void) => void queued.push(run),
    fire: (type: string) => handlers.get(type)?.forEach((handler) => handler()),
    flush: () => queued.splice(0).forEach((run) => run()),
    listening: () => [...handlers].filter(([, set]) => set.size > 0).map(([type]) => type),
  };
  return page;
}

type Fake = Player & { media: Media; plays: number };

function fakePlayer(duration: number): Fake {
  const media = { paused: true, play: () => ((media.paused = false), Promise.resolve()), pause: () => void (media.paused = true) };
  const player: Fake = {
    media,
    plays: 0,
    duration,
    play: () => void (player.plays += 1),
    pause: () => undefined,
    remove: () => undefined,
  };
  return player;
}

const mediaOf = (player: Player) => (player as Fake).media;

describe("web audio players", () => {
  it("asks a refused loop again once a gesture gives the activation, and stops listening", () => {
    const page = fakePage();
    const wrap = webAudio(page, true, mediaOf);
    const loop = wrap(fakePlayer(60)) as Fake;
    loop.play();
    // A pointer down or Escape gives no activation: nothing is asked, and the page listens on.
    page.fire("keydown");
    page.flush();
    expect(loop.plays).toBe(1);
    expect(page.listening()).toContain("click");
    page.active = true;
    page.fire("click");
    expect(loop.plays).toBe(1);
    page.flush();
    expect(loop.plays).toBe(2);
    expect(page.listening()).not.toContain("click");
  });

  it("leaves a loop paused by the gesture itself, and a short sound, quiet", () => {
    const page = fakePage();
    const wrap = webAudio(page, true, mediaOf);
    const loop = wrap(fakePlayer(60)) as Fake;
    const sound = wrap(fakePlayer(1.2)) as Fake;
    loop.play();
    sound.play();
    page.active = true;
    page.fire("click");
    // The click turns Music off before the retry runs.
    loop.pause();
    page.flush();
    expect(loop.plays).toBe(1);
    expect(sound.plays).toBe(1);
  });

  it("waits for no gesture on the desktop", () => {
    const page = fakePage();
    const loop = webAudio(page, false, mediaOf)(fakePlayer(60)) as Fake;
    loop.play();
    expect(page.listening()).not.toContain("click");
  });

  it("pauses what sounds on blur and goes on at focus, unless the app paused it meanwhile", () => {
    const page = fakePage();
    const wrap = webAudio(page, false, mediaOf);
    const calm = wrap(fakePlayer(60)) as Fake;
    const fight = wrap(fakePlayer(60)) as Fake;
    calm.media.paused = false;
    fight.media.paused = false;
    page.fire("blur");
    expect(calm.media.paused).toBe(true);
    expect(fight.media.paused).toBe(true);
    fight.pause();
    page.fire("focus");
    expect(calm.media.paused).toBe(false);
    expect(fight.media.paused).toBe(true);
  });

  it("returns the player as it is for the static render", () => {
    const player = fakePlayer(60);
    expect(webAudio(null, true, mediaOf)(player)).toBe(player);
  });
});

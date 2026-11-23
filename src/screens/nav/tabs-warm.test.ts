import { expect, test } from "vitest";

import { allWarm, HUBS, hubsWarm, markHubWarm, opensOnHubs, subscribeHubsWarm } from "./tabs-warm";

test("the hubs are warm only when every one has mounted", () => {
  expect(allWarm(new Set())).toBe(false);
  expect(allWarm(new Set(HUBS.slice(1)))).toBe(false);
  expect(allWarm(new Set(HUBS))).toBe(true);
});

test("the last hub to mount tells the listeners once", () => {
  let told = 0;
  const stop = subscribeHubsWarm(() => {
    told += 1;
  });
  for (const hub of HUBS.slice(0, -1)) markHubWarm(hub);
  expect(hubsWarm()).toBe(false);
  expect(told).toBe(0);
  markHubWarm(HUBS[HUBS.length - 1]);
  markHubWarm(HUBS[0]);
  expect(hubsWarm()).toBe(true);
  expect(told).toBe(1);
  stop();
});

test("only a launch on a hub waits for the hubs", () => {
  expect(opensOnHubs(["(tabs)"])).toBe(true);
  expect(opensOnHubs(["(tabs)", "decks"])).toBe(true);
  expect(opensOnHubs(["table", "[saveId]"])).toBe(false);
  expect(opensOnHubs([])).toBe(false);
});

test("the dock's routes are the hubs", async () => {
  const { readFileSync } = await import("node:fs");
  const layout = readFileSync(new URL("../routes/(tabs)/_layout.tsx", import.meta.url), "utf8");
  const screens = [...layout.matchAll(/<Tabs\.Screen name="([^"]+)"/g)].map((match) => match[1]);
  expect(screens).toEqual([...HUBS]);
});

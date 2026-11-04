import { describe, expect, it } from "vitest";

import { createPlayClock } from "./play-clock";

function clockAt() {
  let t = 0;
  const clock = createPlayClock(() => t);
  return { clock, at: (ms: number) => void (t = ms) };
}

describe("the play clock", () => {
  it("counts nothing before it is resumed", () => {
    const { clock, at } = clockAt();
    at(5000);
    expect(clock.take()).toBe(0);
  });

  it("counts only resumed spans", () => {
    const { clock, at } = clockAt();
    at(1000);
    clock.resume();
    at(3000);
    clock.pause();
    at(10000);
    clock.resume();
    at(10500);
    clock.pause();
    expect(clock.take()).toBe(2500);
    expect(clock.take()).toBe(0);
  });

  it("hands out the open span up to now and keeps counting", () => {
    const { clock, at } = clockAt();
    clock.resume();
    at(400);
    expect(clock.take()).toBe(400);
    at(1000);
    expect(clock.take()).toBe(600);
    clock.pause();
    at(2000);
    expect(clock.take()).toBe(0);
  });

  it("ignores a second resume and a pause while paused", () => {
    const { clock, at } = clockAt();
    clock.pause();
    clock.resume();
    at(100);
    clock.resume();
    at(300);
    clock.pause();
    clock.pause();
    expect(clock.take()).toBe(300);
  });
});

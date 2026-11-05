// The announcer: lines are said one at a time, in order; the next waits for the phone's announcementFinished event or, failing it, for a
// wait sized to the line; clearing drops what is queued; the listener and the timer are gone once the queue is empty.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announce, clearAnnouncements, waitFor } from "./announce.ts";

const phone = vi.hoisted(() => ({
  os: "ios",
  reader: true,
  said: [] as string[],
  handlers: new Set<(event: { announcement?: string; success?: boolean }) => void>(),
  added: 0,
  removed: 0,
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return phone.os;
    },
  },
  AccessibilityInfo: {
    announceForAccessibility: (text: string) => phone.said.push(text),
    addEventListener: (_name: string, handler: (event: { announcement?: string; success?: boolean }) => void) => {
      phone.handlers.add(handler);
      phone.added += 1;
      return {
        remove: () => {
          phone.handlers.delete(handler);
          phone.removed += 1;
        },
      };
    },
  },
}));

// The phone's accessibility store: announce speaks only while a screen reader is on.
vi.mock("./accessibility.ts", () => ({ accessibility: () => ({ reduceMotion: null, screenReader: phone.reader }) }));

const finish = (announcement?: string) => {
  for (const handler of [...phone.handlers]) handler({ ...(announcement != null ? { announcement } : {}), success: true });
};

beforeEach(() => {
  vi.useFakeTimers();
  phone.os = "ios";
  phone.reader = true;
  phone.said = [];
  phone.added = 0;
  phone.removed = 0;
  phone.handlers.clear();
});

afterEach(async () => {
  // Let every line run out, so the next test starts with an empty announcer.
  clearAnnouncements();
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe("announce", () => {
  it("says the first line at once and holds the others in order", () => {
    announce("one");
    announce("two");
    announce("three");
    expect(phone.said).toEqual(["one"]);
  });

  it("moves on when the phone says the line is finished", () => {
    announce("one");
    announce("two");
    announce("three");
    finish("one");
    expect(phone.said).toEqual(["one", "two"]);
    finish("two");
    expect(phone.said).toEqual(["one", "two", "three"]);
  });

  it("ignores the end of a line it did not say", () => {
    announce("one");
    announce("two");
    finish("something else");
    expect(phone.said).toEqual(["one"]);
    finish();
    expect(phone.said).toEqual(["one", "two"]);
  });

  it("moves on after a wait sized to the line when no event comes", () => {
    announce("one");
    announce("two");
    vi.advanceTimersByTime(waitFor("one") - 1);
    expect(phone.said).toEqual(["one"]);
    vi.advanceTimersByTime(1);
    expect(phone.said).toEqual(["one", "two"]);
  });

  it("waits longer for a longer line, up to a cap", () => {
    expect(waitFor("a".repeat(40))).toBeGreaterThan(waitFor("a"));
    expect(waitFor("a".repeat(5000))).toBe(waitFor("a".repeat(9000)));
  });

  it("does not run the wait of a finished line into the next one", () => {
    announce("one");
    announce("two");
    announce("three");
    vi.advanceTimersByTime(waitFor("one") - 10);
    finish("one");
    // The timer of "one" was cancelled: "two" keeps its own full wait.
    vi.advanceTimersByTime(20);
    expect(phone.said).toEqual(["one", "two"]);
    vi.advanceTimersByTime(waitFor("two"));
    expect(phone.said).toEqual(["one", "two", "three"]);
  });

  it("drops the queued lines on clear and lets the one being said finish", () => {
    announce("one");
    announce("two");
    announce("three");
    clearAnnouncements();
    finish("one");
    expect(phone.said).toEqual(["one"]);
    // The line said after a clear waits for the line before it, so iOS does not drop it.
    announce("four");
    expect(phone.said).toEqual(["one", "four"]);
  });

  it("holds a line made while the last one is still being said, after a clear", () => {
    announce("one");
    clearAnnouncements();
    announce("two");
    expect(phone.said).toEqual(["one"]);
    finish("one");
    expect(phone.said).toEqual(["one", "two"]);
  });

  it("listens only while a line is being said, and leaves no timer behind", () => {
    announce("one");
    announce("two");
    expect(phone.added).toBe(1);
    finish("one");
    finish("two");
    expect(phone.handlers.size).toBe(0);
    expect(phone.removed).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an empty line", () => {
    announce("");
    expect(phone.said).toEqual([]);
    expect(phone.added).toBe(0);
  });

  it("says every line at once on the web, as it always has", () => {
    phone.os = "web";
    announce("one");
    announce("two");
    expect(phone.said).toEqual(["one", "two"]);
    expect(phone.added).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing at all on the phone with no screen reader on", () => {
    phone.reader = false;
    announce("one");
    announce("two");
    expect(phone.said).toEqual([]);
    expect(phone.added).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

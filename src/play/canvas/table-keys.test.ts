// The table's key relay on the web (table-keys.ts): which keys it sends to the root, and that it lets go.
import { afterEach, describe, expect, it, vi } from "vitest";

import { relayKeys, relays, typingIn } from "./table-keys.ts";

const inside = new Set<unknown>();
const root = { contains: (node: unknown) => inside.has(node) };
const press = (key: string, extra: Record<string, unknown> = {}) => ({ key, defaultPrevented: false, target: { tagName: "BODY" }, ...extra });

afterEach(() => {
  inside.clear();
  vi.unstubAllGlobals();
});

describe("typingIn", () => {
  it("is true in a field, a select and an editable box, and false anywhere else", () => {
    for (const target of [{ tagName: "INPUT" }, { tagName: "TEXTAREA" }, { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) expect(typingIn(target)).toBe(true);
    expect(typingIn({ tagName: "BUTTON" })).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});

describe("relays", () => {
  it("sends Escape and Undo pressed outside the root", () => {
    expect(relays(press("Escape"), root)).toBe(true);
    expect(relays(press("z", { ctrlKey: true }), root)).toBe(true);
    expect(relays(press("Z", { shiftKey: false }), root)).toBe(true);
  });

  it("leaves a key pressed inside the root, which reaches it by itself", () => {
    const button = { tagName: "DIV" };
    inside.add(button);
    expect(relays(press("Escape", { target: button }), root)).toBe(false);
  });

  it("leaves every other key, a repeat, a handled key, typing in a field and a page with no table", () => {
    expect(relays(press("a"), root)).toBe(false);
    expect(relays(press("Enter"), root)).toBe(false);
    expect(relays(press("z", { repeat: true }), root)).toBe(false);
    expect(relays(press("Escape", { defaultPrevented: true }), root)).toBe(false);
    expect(relays(press("z", { target: { tagName: "INPUT" } }), root)).toBe(false);
    expect(relays(press("Escape"), null)).toBe(false);
  });
});

describe("relayKeys", () => {
  it("sends the key to the root as a key down, not to a hidden root, and unbinds", () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const dispatched: { type: string; key: string }[] = [];
    let visible = true;
    const table = { contains: () => false, checkVisibility: () => visible, dispatchEvent: (event: { type: string; key: string }) => dispatched.push(event) };
    class FakeKeyboardEvent {
      type: string;
      key: string;
      constructor(type: string, init: { key: string }) {
        this.type = type;
        this.key = init.key;
      }
    }
    vi.stubGlobal("KeyboardEvent", FakeKeyboardEvent);
    vi.stubGlobal("document", { querySelector: () => table });
    vi.stubGlobal("window", {
      addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
      removeEventListener: (type: string, listener: (event: unknown) => void) => {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
    });
    const unbind = relayKeys();
    listeners.get("keydown")?.(press("Escape"));
    listeners.get("keydown")?.(press("a"));
    expect(dispatched).toMatchObject([{ type: "keydown", key: "Escape" }]);
    visible = false;
    listeners.get("keydown")?.(press("z"));
    expect(dispatched).toHaveLength(1);
    unbind();
    expect(listeners.size).toBe(0);
  });
});

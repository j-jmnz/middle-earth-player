// The web shims (web-shims.ts): the one runtime effect the app compiles is the burn's, which the web does without; a deferred dispose frees once.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { deferDispose, IMAGE_FREE_MS } from "./image-free.ts";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("web shims", () => {
  test("the burn is the only caller of RuntimeEffect.Make, so the web may compile none", () => {
    const callers = sources("src")
      .filter((path) => readFileSync(path, "utf8").includes("RuntimeEffect.Make("))
      .map((path) => path.replaceAll("\\", "/"));
    expect(callers).toEqual(["src/play/spotlight/burn.native.tsx"]);
  });

  test("a disposed image is freed once, after the delay", () => {
    const calls: [() => void, number][] = [];
    let freed = 0;
    const image = {
      [Symbol.dispose]() {
        freed += 1;
      },
    };
    const waiting = new WeakSet<object>();
    const free = (callback: () => void, ms: number) => calls.push([callback, ms]);
    deferDispose(free, image, waiting);
    deferDispose(free, image, waiting);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBe(IMAGE_FREE_MS);
    expect(freed).toBe(0);
    calls[0]?.[0]();
    expect(freed).toBe(1);
  });
});

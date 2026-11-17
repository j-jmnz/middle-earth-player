import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLog } from "../log.ts";
import { canvaskitSource, packCanvasKit } from "./pack-canvaskit.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("pack canvaskit", () => {
  it("copies the wasm into a folder it creates, and says how big it is", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pack-canvaskit-"));
    roots.push(root);
    const from = path.join(root, "canvaskit.wasm");
    writeFileSync(from, "\0asm");
    const to = path.join(root, "public", "canvaskit.wasm");
    expect(packCanvasKit(createLog("test"), from, to)).toBe(4);
    expect(readFileSync(to, "utf8")).toBe("\0asm");
  });

  it("refuses when the package is not installed", () => {
    const root = mkdtempSync(path.join(tmpdir(), "pack-canvaskit-"));
    roots.push(root);
    expect(() => packCanvasKit(createLog("test"), path.join(root, "missing.wasm"), path.join(root, "out.wasm"))).toThrow(/pnpm install/);
  });

  it("reads the full build, the one Skia's loader imports", () => {
    expect(canvaskitSource()).toMatch(/canvaskit-wasm[\\/]bin[\\/]full[\\/]canvaskit\.wasm$/);
  });
});

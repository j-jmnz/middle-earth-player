// scripts/desktop/asar.ts reads package.json out of an app.asar and finds the asar beside a packed app's executable.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { asarOf, packedVersion, readAsarFile } from "./asar.ts";

// An asar as @electron/asar writes it: UInt32 4, the header's size, the pickle's size, the JSON's length, the JSON, then the bodies.
function asarOfFiles(files: Record<string, string>): Buffer {
  let offset = 0;
  const tree: Record<string, { size: number; offset: string }> = {};
  for (const [name, body] of Object.entries(files)) {
    tree[name] = { size: Buffer.byteLength(body), offset: String(offset) };
    offset += Buffer.byteLength(body);
  }
  const json = Buffer.from(JSON.stringify({ files: tree }));
  const padded = Math.ceil(json.length / 4) * 4;
  const header = Buffer.alloc(16);
  header.writeUInt32LE(4, 0);
  header.writeUInt32LE(padded + 8, 4);
  header.writeUInt32LE(padded + 4, 8);
  header.writeUInt32LE(json.length, 12);
  return Buffer.concat([header, json, Buffer.alloc(padded - json.length), ...Object.values(files).map((body) => Buffer.from(body))]);
}

const root = mkdtempSync(path.join(tmpdir(), "asar-test-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("scripts/desktop/asar.ts", () => {
  it("reads a top-level file and returns null for one that is not there", () => {
    const file = path.join(root, "a.asar");
    writeFileSync(file, asarOfFiles({ "main.js": "console.log(1)", "package.json": '{"version":"1.2.3"}' }));
    expect(readAsarFile(file, "package.json")?.toString()).toBe('{"version":"1.2.3"}');
    expect(readAsarFile(file, "main.js")?.toString()).toBe("console.log(1)");
    expect(readAsarFile(file, "nope.js")).toBeNull();
  });

  it("finds the asar beside a Windows or Linux executable and inside a macOS bundle, and the version in it", () => {
    const win = path.join(root, "win");
    mkdirSync(path.join(win, "resources"), { recursive: true });
    writeFileSync(path.join(win, "resources", "app.asar"), asarOfFiles({ "package.json": '{"version":"0.2.2"}' }));
    expect(asarOf(path.join(win, "App.exe"))).toBe(path.join(win, "resources", "app.asar"));
    expect(packedVersion(path.join(win, "App.exe"))).toBe("0.2.2");
    const mac = path.join(root, "mac", "App.app", "Contents");
    mkdirSync(path.join(mac, "MacOS"), { recursive: true });
    mkdirSync(path.join(mac, "Resources"), { recursive: true });
    writeFileSync(path.join(mac, "Resources", "app.asar"), asarOfFiles({ "package.json": '{"version":"0.2.3"}' }));
    expect(packedVersion(path.join(mac, "MacOS", "App"))).toBe("0.2.3");
    expect(packedVersion(path.join(root, "Some.AppImage"))).toBeNull();
  });
});

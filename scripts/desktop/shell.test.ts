// The version a desktop build carries and the arguments it gives electron-builder (scripts/desktop/shell.ts, pack.ts).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { APP_NAME } from "../../desktop/identity.ts";
import { builderArgs } from "./pack.ts";
import { appPackage, desktopVersion } from "./shell.ts";

describe("desktopVersion", () => {
  it("is package.json's 0.0.0 without APP_VERSION and the tag's version with it", () => {
    expect(desktopVersion(undefined)).toBe("0.0.0");
    expect(desktopVersion("")).toBe("0.0.0");
    expect(desktopVersion("1.2.3")).toBe("1.2.3");
  });

  it("takes only what app.config.js takes", () => {
    for (const bad of ["v1.2.3", "1.2", "1.2.3-rc.1", "1.1000.0"]) expect(() => desktopVersion(bad), bad).toThrow();
  });
});

describe("appPackage", () => {
  const manifest = appPackage("1.2.3");

  it("names the shell's entry and carries the version and no dependency", () => {
    expect(manifest).toMatchObject({ name: "middle-earth-player", productName: APP_NAME, version: "1.2.3", main: "main.js" });
    expect(manifest).not.toHaveProperty("dependencies");
  });

  it("has what a .deb needs: a description, a homepage and an author with an address", () => {
    expect(manifest).toMatchObject({ description: expect.any(String), homepage: expect.stringContaining("github.com"), author: { email: expect.any(String) } });
  });
});

describe("builderArgs", () => {
  it("builds for the platform it runs on, with the version and the Electron version, and publishes nothing", () => {
    const args = builderArgs("1.2.3", "45.2.1", "linux", ["--dir"]);
    expect(args).toEqual(["exec", "electron-builder", "--config", "desktop/electron-builder.yml", "--linux", "-c.extraMetadata.version=1.2.3", "-c.electronVersion=45.2.1", "--publish", "never", "--dir"]);
    expect(builderArgs("0.0.0", "45.2.1", "win32", [])).toContain("--win");
    expect(builderArgs("0.0.0", "45.2.1", "darwin", [])).toContain("--mac");
    expect(() => builderArgs("0.0.0", "45.2.1", "freebsd", [])).toThrow(/freebsd/);
  });
});

describe("electron-builder.yml", () => {
  const yml = readFileSync(path.join(import.meta.dirname, "..", "..", "desktop", "electron-builder.yml"), "utf8");

  it("keeps the export outside the asar, in resources/web, where the shell serves it from", () => {
    expect(yml).toMatch(/extraResources:\n  - from: desktop\/build\/web\n    to: web/);
    expect(yml).toContain("app: desktop/build/app");
  });

  it("builds the targets the plan names: NSIS and a zip, a universal dmg, an AppImage and a deb", () => {
    for (const target of ["target: nsis", "target: zip", "target: dmg\n      arch: universal", "target: AppImage", "target: deb"]) expect(yml).toContain(target);
    expect(yml).toContain('identity: "-"');
  });
});

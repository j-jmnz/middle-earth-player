// The names that never change after the first release (desktop/identity.ts): OPFS, and with it every save, belongs to the origin and the profile folder.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { APP_HOST, APP_ID, APP_NAME, APP_ORIGIN, APP_SCHEME, APP_URL, MIN_HEIGHT, MIN_WIDTH, USER_DATA_DIR } from "./identity.ts";

const builder = readFileSync(path.join(import.meta.dirname, "electron-builder.yml"), "utf8");
const yml = (key: string) => new RegExp(`^${key}: (.+)$`, "m").exec(builder)?.[1]?.trim();

describe("the permanent names", () => {
  it("are what the first release ships", () => {
    expect(APP_SCHEME).toBe("app");
    expect(APP_HOST).toBe("middle-earth-player");
    expect(APP_ORIGIN).toBe("app://middle-earth-player");
    expect(APP_URL).toBe("app://middle-earth-player/");
    expect(APP_NAME).toBe("Middle-Earth Player");
    expect(USER_DATA_DIR).toBe("Middle-Earth Player");
    expect(APP_ID).toBe("com.middleearth.player");
  });

  it("agree with the installer's", () => {
    expect(yml("appId")).toBe(APP_ID);
    expect(yml("productName")).toBe(APP_NAME);
    // middle-earth-player-<tag>-<os>-<arch>.<ext>, per OS.
    for (const name of ["mac-universal", "win-x64", "linux-x64"]) expect(builder).toContain(`artifactName: middle-earth-player-v\${version}-${name}.\${ext}`);
  });

  it("keep the window at the smallest landscape size of the table", () => {
    expect([MIN_WIDTH, MIN_HEIGHT]).toEqual([844, 390]);
  });
});

describe("the shell's source", () => {
  const main = readFileSync(path.join(import.meta.dirname, "main.ts"), "utf8");
  it("fixes the name and the profile folder from identity.ts and keeps the renderer isolated", () => {
    expect(main).toContain("app.setName(APP_NAME)");
    expect(main).toContain('app.setPath("userData", path.join(app.getPath("appData"), USER_DATA_DIR))');
    for (const line of ["contextIsolation: true", "sandbox: true", "nodeIntegration: false", "webSecurity: true"]) expect(main).toContain(line);
    expect(main).not.toMatch(/nodeIntegration: true|contextIsolation: false|sandbox: false|webSecurity: false/);
  });
});

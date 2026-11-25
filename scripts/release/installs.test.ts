import { describe, expect, it } from "vitest";

import { badgeOf, installsOf, fullCount } from "./installs.ts";

describe("the README's installs badge (docs/releasing.md, Installs count)", () => {
  const asset = (name: string, download_count: number) => ({ name, download_count });

  it("counts the installers of every release and every page, and nothing else", () => {
    const pages = [
      [
        { assets: [asset("middle-earth-player-v0.2.0.apk", 10), asset("middle-earth-player-v0.2.0.apk.sha256", 4), asset("source.json", 900)] },
        { assets: [asset("middle-earth-player-v0.1.0.ipa", 5), asset("middle-earth-player-v0.1.0-win-x64.exe", 3), asset("certificate.sha256", 1)] },
      ],
      [{ assets: [asset("middle-earth-player-v0.0.9-win-x64.zip", 1), asset("middle-earth-player-v0.0.9-mac-universal.dmg", 2), asset("middle-earth-player-v0.0.9-linux-x64.AppImage", 6), asset("middle-earth-player-v0.0.9-linux-x64.deb", 7)] }, {}],
    ];
    expect(installsOf(pages)).toBe(34);
    expect(installsOf(pages[0] ?? [])).toBe(18);
  });

  it("shows every digit of the count, grouped by thousands", () => {
    expect([0, 999, 1000, 1049, 1250, 12_999, 999_999, 1_500_000].map(fullCount)).toEqual(["0", "999", "1,000", "1,049", "1,250", "12,999", "999,999", "1,500,000"]);
    expect(badgeOf(1250)).toEqual({ schemaVersion: 1, label: "installs", message: "1,250", color: "8957E5" });
  });
});

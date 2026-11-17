// `pnpm assets banner`: draws the README's banner in both themes, .github/readme/banner-ringwraiths.webp for GitHub's dark
// theme and banner-rivendell.webp for its light one (the README picks between them with <picture>). Each is the app icon and
// name in Marcellus SC over that theme's tablet still of the Helm's Deep table, standing on the right and faded into the theme's ground
// on the left, where the words are. Chromium lays it out, so the font is the app's own file (assets/fonts) and not whatever the system has.
// Env: BANNER_CHROMIUM is the Chromium binary to use where Playwright's own is not installed (a cloud container has one).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import { runScript } from "../log.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, ".github", "readme");
// Twice the width GitHub shows a README image at (about 830 px), so it stays sharp on a high-density screen.
const WIDTH = 1660;
const HEIGHT = 520;

// The ground and words of each theme (src/screens/kit/palette.js: night, bone, muted).
const THEMES = [
  { name: "ringwraiths", still: "theme-tablet-ringwraiths.webp", ground: "3,4,5", bone: "#EEF2EC", muted: "#A6ADB5" },
  { name: "rivendell", still: "theme-tablet-rivendell.webp", ground: "228,220,203", bone: "#1A1D17", muted: "#46473B" },
] as const;

const dataUrl = (file: string, type: string) => `data:${type};base64,${readFileSync(file).toString("base64")}`;

function page(theme: (typeof THEMES)[number]): string {
  const font = (file: string) => dataUrl(path.join(ROOT, "assets", "fonts", file), "font/ttf");
  const still = dataUrl(path.join(OUT, theme.still), "image/webp");
  const icon = dataUrl(path.join(OUT, "icon.png"), "image/png");
  const fade = `linear-gradient(90deg, rgb(${theme.ground}) 0%, rgb(${theme.ground}) 58%, rgba(${theme.ground},.5) 68%, rgba(${theme.ground},0) 80%)`;
  return `<!doctype html><html><head><style>
    @font-face { font-family: Marcellus; src: url(${font("MarcellusSC-Regular.ttf")}); }
    @font-face { font-family: Barlow; src: url(${font("BarlowSemiCondensed-Regular.ttf")}); }
    html, body { margin: 0; }
    .b { width: ${WIDTH}px; height: ${HEIGHT}px; box-sizing: border-box; padding: 0 96px; display: flex; flex-direction: column; justify-content: center; gap: 22px;
      background: ${fade}, url(${still}) right center / auto 128% no-repeat, rgb(${theme.ground}); }
    .row { display: flex; align-items: center; gap: 30px; }
    img { width: 132px; height: 132px; border-radius: 29px; }
    h1 { margin: 0; font: 400 80px/1 Marcellus, serif; color: ${theme.bone}; }
    p { margin: 0; font: 400 40px/1.25 Barlow, sans-serif; color: ${theme.muted}; max-width: 680px; }
  </style></head><body><div class="b">
    <div class="row"><img src="${icon}" alt=""><h1>Middle-Earth Player</h1></div>
    <p>The Lord of the Rings: The Card Game, solo, on your phone or computer.</p>
  </div></body></html>`;
}

void runScript("showcase-banner", async (log) => {
  // A container's Chromium runs as root and needs the sandbox off, as in scripts/checks/a11y-web.ts.
  const custom = process.env.BANNER_CHROMIUM || undefined;
  const browser = await chromium.launch({ executablePath: custom, args: custom ? ["--no-sandbox"] : [] });
  try {
    const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    for (const theme of THEMES) {
      await tab.setContent(page(theme));
      await tab.evaluate(() => document.fonts.ready);
      const png = await tab.screenshot({ type: "png" });
      const target = path.join(OUT, `banner-${theme.name}.webp`);
      writeFileSync(target, await sharp(png).webp({ quality: 82 }).toBuffer());
      log.debug(`wrote ${path.relative(ROOT, target)}`);
    }
  } finally {
    await browser.close();
  }
});

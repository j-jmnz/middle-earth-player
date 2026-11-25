// `pnpm assets readme-art`: draws the README's tagline and download buttons into .github/readme, at twice the size the README
// shows them so they stay sharp on a high-density screen. The tagline comes in both GitHub themes (tagline-dark.png and
// tagline-light.png, which the README picks between with <picture>); the buttons read on either. GitHub shows a README picture
// with no web font, so Chromium lays the words out in the app's own fonts (assets/fonts) and the PNGs carry them. The accent is
// GitHub's purple, the colour of the README's alerts. Chromium is found as scripts/browser/chromium.ts says.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { launchChromium } from "../browser/chromium.ts";
import { runScript } from "../log.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, ".github", "readme");

// GitHub's purple (its IMPORTANT alert) and the text of its dark and light themes.
const PURPLE = "#8957e5";
const TAGLINE = [
  { file: "tagline-dark.png", words: "#e6dcff", dots: "#ab7df8" },
  { file: "tagline-light.png", words: "#2e1f52", dots: PURPLE },
] as const;

// Each button: its file, its small line, its large line and its icon (stroke paths on a 24 px box), and whether it is the main one.
const BUTTONS = [
  { file: "button-android.png", small: "Download for", large: "Android", icon: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>', main: true },
  { file: "button-sidestore.png", small: "Add the source to", large: "SideStore · AltStore", icon: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>', main: false },
  { file: "button-obtainium.png", small: "Auto-update with", large: "Obtainium", icon: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', main: false },
] as const;

const font = (file: string) => `data:font/ttf;base64,${readFileSync(path.join(ROOT, "assets", "fonts", file)).toString("base64")}`;

function page(body: string): string {
  return `<!doctype html><html><head><style>
    @font-face { font-family: Marcellus; src: url(${font("MarcellusSC-Regular.ttf")}); }
    @font-face { font-family: Barlow; src: url(${font("BarlowSemiCondensed-Regular.ttf")}); }
    @font-face { font-family: Barlow; font-weight: 600; src: url(${font("BarlowSemiCondensed-SemiBold.ttf")}); }
    html, body { margin: 0; background: transparent; }
    #art { display: inline-flex; }
  </style></head><body>${body}</body></html>`;
}

function tagline(theme: (typeof TAGLINE)[number]): string {
  const dot = `<span style="color:${theme.dots}">·</span>`;
  const rule = (direction: string) => `<i style="display:block;width:120px;height:2px;background:linear-gradient(${direction},transparent,${theme.dots})"></i>`;
  return page(`<div id="art" style="align-items:center;gap:32px;padding:8px 4px;font:400 44px/1.2 Marcellus,serif;letter-spacing:.14em;color:${theme.words}">
    ${rule("90deg")}<span>Offline ${dot} Private ${dot} Free ${dot} Open source</span>${rule("270deg")}</div>`);
}

function button(item: (typeof BUTTONS)[number]): string {
  const ground = item.main ? PURPLE : "#1d1530";
  const border = item.main ? "#a371f7" : PURPLE;
  const icon = item.main ? "#ffffff" : "#c4a6ff";
  const small = item.main ? "#efe6ff" : "#c9b8ec";
  return page(`<div id="art" style="align-items:center;gap:20px;box-sizing:border-box;height:104px;padding:0 36px 0 26px;border-radius:20px;background:${ground};border:2px solid ${border};font-family:Barlow,sans-serif">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${icon}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${item.icon}</svg>
    <span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:24px;line-height:1.1;color:${small}">${item.small}</span><span style="font-size:34px;line-height:1.1;font-weight:600;color:#ffffff">${item.large}</span></span></div>`);
}

void runScript("showcase-readme-art", async (log) => {
  const browser = await launchChromium();
  try {
    const tab = await browser.newPage({ viewport: { width: 1660, height: 400 } });
    const pieces = [...TAGLINE.map((theme) => ({ file: theme.file, html: tagline(theme) })), ...BUTTONS.map((item) => ({ file: item.file, html: button(item) }))];
    for (const piece of pieces) {
      await tab.setContent(piece.html);
      await tab.evaluate(() => document.fonts.ready);
      const target = path.join(OUT, piece.file);
      writeFileSync(target, await tab.locator("#art").screenshot({ type: "png", omitBackground: true }));
      log.debug(`wrote ${path.relative(ROOT, target)}`);
    }
  } finally {
    await browser.close();
  }
});

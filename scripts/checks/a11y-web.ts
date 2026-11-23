// `pnpm test a11y`: the web build audited with axe-core. The static web export (scripts/browser/web-export.ts, with the e2e seed so the fixture route writes
// saves) is served on localhost and opened in Chromium (scripts/browser/chromium.ts) at phone width. Each main screen is opened in a fresh page, waited
// on until its testID is there, and run through axe; a serious or critical violation fails the run. Nothing leaves localhost: every other request is
// aborted (card pictures come from the network in the web build), so the check runs offline.
//
// Flags: --skip-export reuses the last export even when its inputs changed (an unchanged one is always reused).
//
// The web build is a development aid (ACCESSIBILITY.md, Known gaps): the native app is what the players use. This check finds what react-native-web's
// output and the shared kit get wrong for a reader's tree (names, roles, contrast, targets), not what VoiceOver or TalkBack do.
import { AxeBuilder } from "@axe-core/playwright";
import type { Browser, BrowserContext } from "playwright";

import { launchChromium } from "../browser/chromium.ts";
import { ensureExport, serveExport } from "../browser/web-export.ts";
import { runScript, type Log } from "../log.ts";

// No rule is disabled: every rule axe runs applies to react-native-web's output, which is plain HTML.
//
// Findings still open, as the most elements one screen may show (the larger of its light and dark counts). A count above it fails the run, and so
// does a count below it, so the number is lowered as a screen is fixed. Label in Name (WCAG 2.5.3): each remaining element's accessible name starts
// with its visible words ("Scenario 1, A Shadow of the Past, 3 quest stages", "Threat 20, P1, acting"), but axe joins the visible text of sibling
// blocks with no space on react-native-web ("1A Shadow of the Past3 quest stages", "20P1") and finds no such run in the name. They are axe's text
// join on react-native-web's output, not wording; VoiceOver and TalkBack read the names as written.
const OPEN: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "label-content-name-mismatch": { Scenarios: 6, History: 1, Decks: 2 },
};

// Only these fail the run; minor and moderate findings are listed.
const FAILING = new Set(["serious", "critical"]);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Screen = {
  name: string;
  route: string;
  /** The testID that says the screen has settled. */
  ready: string;
  /** The table is drawn in landscape; everything else at phone width. */
  landscape?: boolean;
};

// The e2e fixture route writes a save from a committed fixture (src/screens/routes/e2e/[fixture].tsx), so the table opens on a real game.
const FIXTURE = "duo";
const SAVE = `save-e2e-${FIXTURE}`;
const SCREENS: readonly Screen[] = [
  { name: "Campaigns", route: "/", ready: "campaign-list" },
  { name: "Scenarios", route: "/scenarios", ready: "scenarios" },
  { name: "History", route: "/history", ready: "history" },
  { name: "Decks", route: "/decks", ready: "decks" },
  { name: "Cards", route: "/cards", ready: "pool-search" },
  { name: "Settings", route: "/settings", ready: "app-settings" },
  { name: "Rules", route: "/rules", ready: "rules" },
  { name: "Card", route: "/card/01001", ready: "card-text" },
  { name: "Table", route: `/table/${SAVE}`, ready: "table", landscape: true },
];

type Finding = { screen: string; scheme: string; rule: string; impact: string; help: string; count: number; targets: string[] };

async function audit(context: BrowserContext, base: string, screen: Screen, scheme: string, log: Log): Promise<Finding[]> {
  const page = await context.newPage();
  try {
    await page.setViewportSize(screen.landscape ? { width: 844, height: 390 } : { width: 390, height: 844 });
    await page.goto(base + screen.route);
    await page.waitForSelector(`[data-testid="${screen.ready}"]`, { timeout: 30_000 });
    // Reduced motion snaps the screen's fades; the wait lets a late list row land.
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    log.debug(`${screen.name} (${scheme}): ${results.passes.length} rules passed, ${results.violations.length} violated`);
    return results.violations.map((violation) => ({
      screen: screen.name,
      scheme,
      rule: violation.id,
      impact: violation.impact ?? "minor",
      help: violation.help,
      count: violation.nodes.length,
      targets: violation.nodes.slice(0, 4).map((node) => node.target.join(" ")),
    }));
  } finally {
    await page.close();
  }
}

// What fails the run: a serious or critical finding beyond what OPEN allows its screen, and an OPEN number that is higher than what is found.
function verdict(findings: readonly Finding[]): string[] {
  const worst = new Map<string, number>();
  for (const item of findings) {
    if (!FAILING.has(item.impact)) continue;
    const key = `${item.rule}|${item.screen}`;
    worst.set(key, Math.max(worst.get(key) ?? 0, item.count));
  }
  const problems: string[] = [];
  for (const [key, count] of worst) {
    const [rule, screen] = key.split("|") as [string, string];
    const allowed = OPEN[rule]?.[screen] ?? 0;
    if (count > allowed) problems.push(`${screen}: ${rule} on ${count} element${count === 1 ? "" : "s"}${allowed > 0 ? ` (${allowed} are known open)` : ""}`);
  }
  for (const [rule, screens] of Object.entries(OPEN)) {
    for (const [screen, allowed] of Object.entries(screens)) {
      const count = worst.get(`${rule}|${screen}`) ?? 0;
      if (count < allowed) problems.push(`${screen}: ${rule} is down to ${count}; lower its OPEN number from ${allowed}`);
    }
  }
  return problems;
}

async function main(log: Log): Promise<void> {
  const { server, base } = await serveExport(ensureExport(log, { reuse: process.argv.includes("--skip-export") }));
  let browser: Browser | undefined;
  try {
    browser = await launchChromium();
    const findings: Finding[] = [];
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, reducedMotion: "reduce" });
      // Card pictures come from the network in the web build; the check stays on localhost.
      await context.route((url) => url.hostname !== "127.0.0.1", (route) => route.abort());
      // The table opens on a save the fixture route writes.
      const seed = await context.newPage();
      await seed.goto(`${base}/e2e/${FIXTURE}`);
      await seed.waitForSelector('[data-testid="campaign-path"]', { timeout: 30_000 });
      await seed.close();
      for (const screen of SCREENS) {
        const found = await audit(context, base, screen, scheme, log);
        log.debug(`${screen.name} (${scheme}): ${found.length === 0 ? "no violations" : found.map((item) => `${item.rule} x${item.count}`).join(", ")}`);
        findings.push(...found);
      }
      await context.close();
    }
    const problems = verdict(findings);
    // Minor and moderate findings are listed under --verbose; a serious or critical one is printed in full when the run fails.
    for (const item of findings) {
      const detail = `${item.screen} (${item.scheme}): ${item.rule} (${item.impact}) x${item.count}: ${item.help}\n${item.targets.map((target) => `  ${target}`).join("\n")}`;
      if (problems.length > 0 && FAILING.has(item.impact)) log.error(detail);
      else log.debug(detail);
    }
    for (const problem of problems) log.error(problem);
    if (problems.length > 0) throw new Error(`${problems.length} serious or critical finding${problems.length === 1 ? "" : "s"} on the web build`);
  } finally {
    await browser?.close();
    server.close();
  }
}

await runScript("a11y:web", main);

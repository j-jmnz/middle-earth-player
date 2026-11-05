// The screen reader check over the app's screens (docs/design-system.md, Screen reader): every raw control has a role and a name, a long press is
// also an action, a text input is labelled, and a picture is labelled or hidden. a11y.ts is the checker; this file runs it over src/**/*.tsx
// and holds the exceptions, each with its reason. An exception that no finding matches fails the test, so the list never goes stale.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { a11yFindings, type Finding, type Rule } from "./a11y.ts";
import { ROOT, tracked } from "./tracked.ts";

type Exception = { file: string; rule: Rule; tag: string; testID?: string; reason: string };

// A finding is exempt when its file, rule and tag (and test id, when given) match one entry.
const EXCEPTIONS: readonly Exception[] = [
  {
    file: "src/play/canvas/table-canvas.native.tsx",
    rule: "picture-label",
    tag: "Canvas",
    reason: "The table's Skia canvas is the sighted drawing. With a reader on, ReaderTable replaces it (reader-table.tsx), so the canvas is never what a reader reaches.",
  },
  {
    file: "src/play/canvas/table-canvas.tsx",
    rule: "long-press-action",
    tag: "Pressable",
    reason: "The web list of the table stays as it is (user instruction, 2026-11-05: the web build is unchanged); react-native-web has no actions menu. The phone's reader table has the Show card action.",
  },
];

const matches = (exception: Exception, file: string, finding: Finding): boolean =>
  exception.file === file && exception.rule === finding.rule && exception.tag === finding.tag && (exception.testID === undefined || exception.testID === finding.testID);

function scan(): { file: string; finding: Finding }[] {
  const files = tracked().filter((file) => /^src\/.*\.tsx$/.test(file) && !/\.test\.tsx$/.test(file));
  return files.flatMap((file) => a11yFindings(readFileSync(path.join(ROOT, file), "utf8"), file).map((finding) => ({ file, finding })));
}

describe("the screens are usable with a screen reader", () => {
  const found = scan();

  it("has no raw control without a role, a name, an action for its long press or a label", () => {
    const open = found.filter(({ file, finding }) => !EXCEPTIONS.some((exception) => matches(exception, file, finding)));
    expect(open.map(({ file, finding }) => `${file}:${finding.line} ${finding.rule} <${finding.tag}${finding.testID ? ` testID="${finding.testID}"` : ""}>`)).toEqual([]);
  });

  it("lists no exception that nothing needs", () => {
    const stale = EXCEPTIONS.filter((exception) => !found.some(({ file, finding }) => matches(exception, file, finding)));
    expect(stale.map((exception) => `${exception.file} ${exception.rule} <${exception.tag}>`)).toEqual([]);
  });

  it("gives every exception a reason", () => {
    expect(EXCEPTIONS.filter((exception) => exception.reason.trim().length < 20)).toEqual([]);
  });
});

const rules = (source: string): Rule[] => a11yFindings(source).map((finding) => finding.rule);

describe("the checker", () => {
  it("wants a role on a raw press", () => {
    expect(rules(`<Pressable onPress={go}><Text>Go</Text></Pressable>`)).toEqual(["press-role"]);
    expect(rules(`<Pressable accessibilityRole="button" onPress={go}><Text>Go</Text></Pressable>`)).toEqual([]);
  });

  it("wants a name: a label, or text inside", () => {
    expect(rules(`<Pressable accessibilityRole="button" onPress={go}><View /></Pressable>`)).toEqual(["press-name"]);
    expect(rules(`<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={go}><View /></Pressable>`)).toEqual([]);
    expect(rules(`<Pressable accessibilityRole="button" onPress={go}>{({ pressed }) => <Text>{label}</Text>}</Pressable>`)).toEqual([]);
    expect(rules(`<Pressable accessibilityRole="button" onPress={go}>{({ pressed }) => <View />}</Pressable>`)).toEqual(["press-name"]);
  });

  it("checks a Text that is pressed, and leaves a plain Text alone", () => {
    expect(rules(`<Text onPress={go}>Open</Text>`)).toEqual(["press-role"]);
    expect(rules(`<Text>Open</Text>`)).toEqual([]);
  });

  it("lets a press that hides itself have no role or name", () => {
    expect(rules(`<Pressable accessible={false} importantForAccessibility="no" onPress={go} />`)).toEqual([]);
  });

  it("wants an action for a long press, from the helpers or by hand", () => {
    expect(rules(`<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={go} onLongPress={more} />`)).toEqual(["long-press-action"]);
    expect(rules(`<Pressable accessibilityRole="button" accessibilityLabel="Go" {...longPressA11y("Show card large", more)} onPress={go} onLongPress={more} />`)).toEqual([]);
    expect(rules(`<Pressable accessibilityRole="button" accessibilityLabel="Go" {...mergeA11yActions(moves, longPressA11y("Show", more))} onPress={go} onLongPress={more} />`)).toEqual([]);
    expect(rules(`<Pressable accessibilityRole="button" accessibilityLabel="Go" accessibilityActions={actions} onPress={go} onLongPress={more} />`)).toEqual([]);
  });

  it("wants a label on a text input", () => {
    expect(rules(`<TextInput value={v} />`)).toEqual(["input-label"]);
    expect(rules(`<TextInput accessibilityLabel="Notes" value={v} />`)).toEqual([]);
  });

  it("wants a picture labelled or hidden, or inside a labelled control", () => {
    expect(rules(`<Image source={s} />`)).toEqual(["picture-label"]);
    expect(rules(`<Image source={s} accessibilityLabel="Frodo" />`)).toEqual([]);
    expect(rules(`<Image source={s} accessible={false} />`)).toEqual([]);
    expect(rules(`<Image source={s} importantForAccessibility="no-hide-descendants" />`)).toEqual([]);
    expect(rules(`<View accessibilityLabel="Frodo"><Image source={s} /></View>`)).toEqual([]);
    expect(rules(`<View accessibilityElementsHidden><Canvas /></View>`)).toEqual([]);
    expect(rules(`<Canvas style={s} />`)).toEqual(["picture-label"]);
  });

  it("does not take a Skia Image or Text drawn into a canvas for a view", () => {
    expect(rules(`import { Canvas, Image, Text } from "@shopify/react-native-skia";\n<Canvas accessibilityElementsHidden><Image image={i} /><Text text="1" onPress={go} /></Canvas>`)).toEqual([]);
  });

  it("flags a CardImage that is labelled and hidden at once", () => {
    expect(rules(`<CardImage source={s} accessibilityLabel="Frodo" accessible={false} />`)).toEqual(["picture-label"]);
    expect(rules(`<CardImage source={s} />`)).toEqual([]);
  });

  it("trusts a spread for the props it may carry, and reports the line and test id", () => {
    expect(rules(`<Pressable {...props} onPress={go} />`)).toEqual([]);
    const [finding] = a11yFindings(`const a = 1;\n<Pressable testID="x" onPress={go} />`);
    expect(finding).toMatchObject({ rule: "press-role", line: 2, testID: "x" });
  });
});

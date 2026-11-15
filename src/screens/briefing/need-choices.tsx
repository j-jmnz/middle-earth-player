// A Campaign Setup choice on a briefing (docs/design-system.md, Briefing), its rows the same container as the campaign card's and the quest cards'.
// A choice of a card for a hero (The Oath's Adaptation boons) is two short radio lists, the card and then the hero who carries it, and is made
// once both are picked; any other choice is one list, made on a tap, with Skip as a text button under it. A card's thumbnail opens it large, as
// does a long press on its row.
import { inArray } from "drizzle-orm";
import { useContext, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { cards } from "../../catalog/schema";
import { longPressA11y } from "../../ui/long-press-action";
import { rowSurface, selectedRingOf, selectedWash } from "../../ui/surfaces";
import { Text } from "../../ui/text";
import { touchSlop, useUiScale } from "../../ui/ui-scale";
import { useTableTokens } from "../../ui/use-table-tokens";
import type { HeroFace } from "../art/hero-tile";
import { useDatabases } from "../data/databases";
import { Label, TextButton } from "../kit/chrome";
import { CardThumb, HeroPainting } from "./card-thumb";
import { hostOffered, optionCard, optionLabel, pairedChoice, pickPair } from "./choice-groups";
import { OpenCardContext } from "./parts";
import { actionLine, gainLine } from "./words";

type Printed = { text: string | null; imagesrc: string | null };

type Props = {
  options: readonly string[];
  words?: Readonly<Record<string, string>>;
  nameOf: (code: string) => string;
  faceOf: (code: string) => HeroFace;
  // The option and what it is called, for the line the seat keeps once it has chosen.
  onChoose: (option: string, label: string) => void;
  // What the cards of a card-for-a-hero choice are called over their list ("Boon" for The Oath's Adaptations).
  cardWord?: string;
};

/**
 * One option: a row on the dark wash, its name in Marcellus SC with up to two muted lines under it. A radio wears the silver ring and wash with the
 * word Selected when picked, so the mark does not rest on colour; a dimmed row cannot be picked.
 */
function ChoiceRow({
  testID,
  label,
  lines,
  leading,
  radio,
  selected,
  disabled,
  onPress,
  onLongPress,
}: {
  testID: string;
  label: string;
  lines: readonly string[];
  leading?: ReactNode;
  radio: boolean;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const state = radio ? { selected, checked: selected, disabled } : { disabled };
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole={radio ? "radio" : "button"}
      accessibilityLabel={[label, ...lines].join(" ")}
      accessibilityState={state}
      aria-checked={radio ? selected : undefined}
      disabled={disabled}
      {...(onLongPress ? longPressA11y("Show card", onLongPress) : null)}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="mb-1.5"
    >
      {/* The surface is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        <View
          className="min-h-14 flex-row items-center gap-3 rounded-item py-2"
          style={{ paddingLeft: 14 * s, paddingRight: 12 * s, opacity: disabled ? 0.35 : 1, ...(selected ? { ...selectedWash(t), boxShadow: selectedRingOf(t, 1.5) } : rowSurface(pressed, t)) }}
        >
          {leading}
          <View className="flex-1">
            <Text className={`font-display text-heading ${selected ? "text-accentHigh" : "text-bone"}`}>{label}</Text>
            {lines.map((line) => (
              <Text key={line} className="mt-0.5 text-label text-muted">
                {line}
              </Text>
            ))}
          </View>
          {selected ? <Text className="text-label font-semibold text-accent">Selected</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

// A card's thumbnail as its own control: a tap shows the card large. Its slop makes the 32 × 44 picture a 44 pt target.
function PreviewThumb({ code, name, imagesrc, onOpen }: { code: string; name: string; imagesrc: string | null; onOpen: (code: string) => void }) {
  const s = useUiScale();
  const slop = touchSlop(s, 32 * s);
  return (
    <Pressable testID={`choice-show-${code}`} accessibilityRole="button" accessibilityLabel={`Show ${name}`} hitSlop={{ left: slop, right: slop }} onPress={() => onOpen(code)}>
      <CardThumb code={code} imagesrc={imagesrc} />
    </Pressable>
  );
}

export function NeedChoices({ options, words, nameOf, faceOf, onChoose, cardWord }: Props) {
  const openCard = useContext(OpenCardContext);
  const { catalog } = useDatabases();
  const paired = pairedChoice(options);
  // The offered cards' printed text (for the lines under each) and pictures, read once per choice.
  const codes = useMemo(() => [...new Set(options.filter((option) => option !== "skip" && !words?.[option]).map(optionCard))], [options, words]);
  const printed = useMemo<ReadonlyMap<string, Printed>>(
    () => (codes.length === 0 ? new Map() : new Map(catalog.select({ code: cards.code, text: cards.text, imagesrc: cards.imagesrc }).from(cards).where(inArray(cards.code, codes)).all().map((row) => [row.code, { text: row.text, imagesrc: row.imagesrc }]))),
    [catalog, codes],
  );
  const textOf = useMemo(() => Object.fromEntries([...printed].map(([code, row]) => [code, row.text])), [printed]);
  const [card, setCard] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const labelOf = (option: string) => optionLabel(option, nameOf, textOf, words);
  // What a card does, in the lines its row shows: the icon it grants and its Action (a boon), else nothing.
  const linesOf = (code: string) => {
    const text = printed.get(code)?.text;
    return [gainLine(text), actionLine(text)].filter((line): line is string => line != null);
  };
  const thumb = (code: string) => <PreviewThumb code={code} name={nameOf(code)} imagesrc={printed.get(code)?.imagesrc ?? null} onOpen={openCard} />;

  if (paired) {
    // Made as soon as both halves are picked, in either order; a hero the picked card cannot go on is dimmed and let go.
    const pick = (nextCard: string | null, nextHost: string | null) => {
      const next = pickPair(options, nextCard, nextHost);
      setCard(next.card);
      setHost(next.host);
      if (next.option) onChoose(next.option, labelOf(next.option));
    };
    return (
      <>
        <Label className="mb-1.5">{cardWord ?? "Card"}</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel={cardWord ?? "Card"}>
          {paired.cards.map((code) => (
            <ChoiceRow
              key={code}
              testID={`choice-card-${code}`}
              label={labelOf(code)}
              lines={linesOf(code)}
              leading={thumb(code)}
              radio
              selected={card === code}
              disabled={false}
              onPress={() => pick(code, host)}
              onLongPress={() => openCard(code)}
            />
          ))}
        </View>
        <Label className="mb-1.5 mt-3">Carried by</Label>
        <View accessibilityRole="radiogroup" accessibilityLabel="Carried by">
          {paired.hosts.map((code) => (
            <ChoiceRow
              key={code}
              testID={`choice-host-${code}`}
              label={nameOf(code)}
              lines={[]}
              leading={<HeroPainting face={faceOf(code)} />}
              radio
              selected={host === code}
              disabled={!hostOffered(options, card, code)}
              onPress={() => pick(card, code)}
              onLongPress={() => openCard(code)}
            />
          ))}
        </View>
        {paired.skip ? (
          <View className="items-start">
            <TextButton label="Skip" testID="choice-skip" onPress={() => onChoose("skip", "Skip")} />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <>
      {options
        .filter((option) => option !== "skip")
        .map((option) => {
          // An option that is not a card (put resources on the heroes) has its own words, no thumbnail and no card to open.
          const plain = words?.[option] != null;
          return (
            <ChoiceRow
              key={option}
              testID={`choice-${option}`}
              label={labelOf(option)}
              lines={plain ? [] : linesOf(optionCard(option))}
              {...(plain ? {} : { leading: thumb(optionCard(option)), onLongPress: () => openCard(optionCard(option)) })}
              radio={false}
              selected={false}
              disabled={false}
              onPress={() => onChoose(option, labelOf(option))}
            />
          );
        })}
      {options.includes("skip") ? (
        <View className="items-start">
          <TextButton label="Skip" testID="choice-skip" onPress={() => onChoose("skip", "Skip")} />
        </View>
      ) : null}
    </>
  );
}

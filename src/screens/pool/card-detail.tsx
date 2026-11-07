// A card's details (docs/design-system.md, Card): its row from the catalog, its picture, the facts under the name (type, sphere and
// traits on one line, the stats), its text, its errata and the decks it is in. The card screen draws them under the picture;
// the Cards hub on a tablet in landscape draws them in the pane beside the pool (CardDetailPane), with no navigation.
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";

import { cards } from "../../catalog/schema";
import { Chevron, Eyebrow, sphereWord, useTitleShadow } from "../kit/chrome";
import { useDatabases } from "../data/databases";
import { listDecks } from "../deck/store";
import { enqueueImageDownloads } from "../images/queue";
import { imageLayoutSize, shownCardImage } from "../images/policy";
import { remotePictureUrl } from "../images/remote";
import { InspectCardImage } from "../images/picture";
import { scanAssets } from "../images/scan-map";
import { useCachedImage } from "../images/store";
import { usePalette } from "../kit/palette-hook";
import { cardCorner } from "../../ui/card-corner";
import { CardTextView } from "../../play/cards/card-text-view";
import { traitLine } from "../../play/cards/card-text";
import { GameIcon } from "../../ui/game-icon";
import { SPHERE_TINT, sphereIcon, typeIcon, type IconName } from "../../ui/icon-map";
import { notApplied, type NotApplied } from "../../play/cards/not-applied";
import { NotAppliedView } from "../../play/cards/not-applied-view";
import { dropShadowOf, rowSurface } from "../../ui/surfaces";
import { withAlphaHex, type TableTokens } from "../../ui/tokens";
import { useTableTokens } from "../../ui/use-table-tokens";
import { useUiScale } from "../../ui/ui-scale";
import { Text } from "../../ui/text";

export type CardRow = {
  code: string;
  name: string;
  typeCode: string;
  typeName: string;
  sphereCode: string | null;
  sphereName: string | null;
  cost: string | null;
  threat: number | null;
  willpower: number | null;
  attack: number | null;
  defense: number | null;
  health: number | null;
  questPoints: number | null;
  engagementCost: number | null;
  isUnique: boolean;
  traits: string | null;
  text: string | null;
  errata: string | null;
  imagesrc: string | null;
};

/** The catalog's row for a card, or undefined when the catalog lacks it. */
export function useCardRow(code: string | null): CardRow | undefined {
  const { catalog } = useDatabases();
  return useMemo(() => {
    if (!code) return undefined;
    return catalog
      .select({
        code: cards.code,
        name: cards.name,
        typeCode: cards.typeCode,
        typeName: cards.typeName,
        sphereCode: cards.sphereCode,
        sphereName: cards.sphereName,
        cost: cards.cost,
        threat: cards.threat,
        willpower: cards.willpower,
        attack: cards.attack,
        defense: cards.defense,
        health: cards.health,
        questPoints: cards.quest,
        engagementCost: cards.engagementCost,
        isUnique: cards.isUnique,
        traits: cards.traits,
        text: cards.text,
        errata: cards.errata,
        imagesrc: cards.imagesrc,
      })
      .from(cards)
      .where(eq(cards.code, code))
      .get();
  }, [catalog, code]);
}

/**
 * The card's picture as the screens draw it: the cached file, the bundled scan, or the remote preview while neither is on the phone;
 * its intrinsic size, so a quest card (printed sideways) is told apart; and the download queued once.
 */
export function useCardPicture(code: string | null, imagesrc: string | null) {
  const cached = useCachedImage(code ?? "");
  const bundled = code ? (scanAssets[code] ?? null) : null;
  const { resolved, source } = shownCardImage({ cached, imagesrc, bundled });
  const remote = !source && imagesrc ? remotePictureUrl(imagesrc) : null;
  const preview = source ?? (remote ? { uri: remote } : null);
  const intrinsic = resolved.kind === "file" || resolved.kind === "asset" ? { width: resolved.width, height: resolved.height } : remote ? { width: 423, height: 600 } : null;
  useEffect(() => {
    if (!code || !imagesrc) return;
    enqueueImageDownloads([{ code, imagesrc, first: true }]);
  }, [code, imagesrc]);
  return { preview, intrinsic };
}

/** The glow a card's picture stands in: its sphere's colour, else the accent, over a deep shadow. */
export function cardGlowOf(sphereCode: string | null, palette: ReturnType<typeof usePalette>, t: TableTokens): string {
  const tint = SPHERE_TINT[sphereCode ?? ""];
  const color = tint && tint !== "faint" ? palette[tint] : palette.accent;
  return `${dropShadowOf(t, 30, 60, 0.95)}, 0 0 60px ${withAlphaHex(color, 0.35)}`;
}

/** The picture at `width`, rounded and lit by its sphere's glow. `children` wraps the image (the card screen's pinch zoom). */
export function CardPicture({ row, preview, intrinsic, width, wrap }: {
  row: Pick<CardRow, "code" | "name" | "sphereCode">;
  preview: { uri: string } | number;
  intrinsic: { width: number; height: number };
  width: number;
  wrap?: (image: React.ReactNode, size: { width: number; height: number }) => React.ReactNode;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const size = imageLayoutSize(intrinsic.width, intrinsic.height, width);
  const image = <InspectCardImage code={row.code} name={row.name} source={preview} width={size.width} height={size.height} />;
  // The card screen's corner, the one every card picture shares (10 pt at its 236 pt phone width).
  const corner = cardCorner(size.width, size.height);
  return (
    <View className="self-center" style={{ width: size.width, height: size.height, borderRadius: corner, boxShadow: cardGlowOf(row.sphereCode, palette, t) }}>
      <View style={{ width: size.width, height: size.height, borderRadius: corner, overflow: "hidden" }}>{wrap ? wrap(image, size) : image}</View>
    </View>
  );
}

function costOrThreat(row: { typeCode: string; cost: string | null; threat: number | null }): { label: "Cost" | "Threat"; value: string } | null {
  if (row.typeCode === "hero") {
    if (row.threat != null) return { label: "Threat", value: String(row.threat) };
    if (row.cost) return { label: "Cost", value: row.cost };
    return null;
  }
  if (row.cost && row.cost.length > 0) return { label: "Cost", value: row.cost };
  if (row.threat != null) return { label: "Threat", value: String(row.threat) };
  return null;
}

// A number with the game's icon beside it in Marcellus SC, its word in small capitals under them, on the ground with no surface. The
// word stays in the label.
function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  const s = useUiScale();
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} className="min-w-14 flex-1 items-center px-1.5 py-1">
      <View className="flex-row items-center gap-1">
        <GameIcon name={icon} size={15 * s} tint="muted" />
        <Text className="font-display text-bone" style={{ fontSize: 22 * s, lineHeight: 27 * s }}>
          {value}
        </Text>
      </View>
      <Text className="mt-0.5 font-bold uppercase text-faint" style={{ fontSize: 9 * s, lineHeight: 12 * s, letterSpacing: 1 * s, textAlign: "center" }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** The name in Marcellus SC with the unique mark before it, then type, sphere and traits on one line. */
export function CardName({ row, size = 28 }: { row: CardRow; size?: number }) {
  const s = useUiScale();
  const shadow = useTitleShadow();
  const type = typeIcon(row.typeCode);
  const sphere = row.sphereName || type ? sphereWord(row.sphereName) : null;
  const traits = traitLine(row.traits);
  const mark = sphereIcon(row.sphereCode);
  return (
    <View className="items-center">
      <View className="flex-row items-center justify-center gap-2">
        {row.isUnique ? <GameIcon name="unique" size={(size * 0.62) * s} tint="bone" /> : null}
        <Text accessibilityRole="header" className="text-center font-display text-bone" style={{ fontSize: size * s, lineHeight: size * 1.2 * s, ...shadow }}>
          {row.name ?? row.code}
        </Text>
      </View>
      <View testID="card-kind" className="mt-1.5 flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          {type ? <GameIcon name={type} size={14 * s} tint="muted" /> : null}
          <Text className="text-label text-muted">{row.typeName}</Text>
        </View>
        {sphere ? (
          <View className="flex-row items-center gap-1.5">
            {mark ? <GameIcon name={mark} size={14 * s} tint={SPHERE_TINT[row.sphereCode ?? ""] ?? "faint"} /> : null}
            <Text className="text-label text-muted">{sphere}</Text>
          </View>
        ) : null}
        {traits ? (
          <Text testID="card-traits" className="text-label italic text-muted">
            {traits}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** The row of stats and the card's text, with the lines no effect record reads and what the card still does without them. */
export function CardFacts({ row }: { row: CardRow }) {
  const unapplied: NotApplied | null = notApplied(row.code, row.typeCode, row.errata ?? row.text);
  const cost = costOrThreat(row);
  const stats: { label: string; value: string; icon: IconName }[] = [
    ...(cost ? [{ label: cost.label, value: cost.value, icon: cost.label === "Cost" ? ("cost" as const) : ("threat" as const) }] : []),
    ...(row.willpower != null ? [{ label: "Willpower", value: String(row.willpower), icon: "willpower" as const }] : []),
    ...(row.attack != null ? [{ label: "Attack", value: String(row.attack), icon: "attack" as const }] : []),
    ...(row.defense != null ? [{ label: "Defense", value: String(row.defense), icon: "defense" as const }] : []),
    ...(row.health != null ? [{ label: "Hit points", value: String(row.health), icon: "hitPoints" as const }] : []),
    ...(row.engagementCost != null ? [{ label: "Engagement", value: String(row.engagementCost), icon: "engagementCost" as const }] : []),
    ...(row.questPoints != null ? [{ label: "Quest points", value: String(row.questPoints), icon: "questPoints" as const }] : []),
  ];
  return (
    <View>
      {stats.length > 0 ? (
        <View testID="card-stats" className="mt-4 flex-row flex-wrap justify-center gap-y-2">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </View>
      ) : null}
      {row.text || unapplied ? (
        <View className="mt-5">
          <CardTextView text={row.text} testID="card-text" />
          {unapplied ? (
            <View className={row.text ? "mt-3 pt-3" : undefined}>
              <NotAppliedView notApplied={unapplied} />
            </View>
          ) : null}
        </View>
      ) : null}
      {row.errata ? (
        <View className="mt-5">
          <Eyebrow tone="accent" header>Errata</Eyebrow>
          <View className="mt-2">
            <CardTextView text={row.errata} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** "In 2 decks · Stealth and Steadfastness, …": the saved decks that hold the card, as a row that opens Decks. Nothing when none do. */
export function DeckUse({ code }: { code: string }) {
  const { user } = useDatabases();
  const router = useRouter();
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const names = useMemo(
    () =>
      listDecks(user)
        .filter((deck) => deck.heroes.includes(code) || deck.cards.some((card) => card.code === code))
        .map((deck) => deck.name),
    [user, code],
  );
  if (names.length === 0) return null;
  return (
    <Pressable testID="card-decks" accessibilityRole="button" accessibilityLabel={`In ${names.length} ${names.length === 1 ? "deck" : "decks"}: ${names.join(", ")}`} onPress={() => router.navigate("/decks")}>
      {({ pressed }) => (
        <View className="mt-4 flex-row items-center gap-3 rounded-item px-3.5" style={{ minHeight: 48 * s, ...rowSurface(pressed, t) }}>
          <Text className="min-w-0 flex-1 text-label text-muted" numberOfLines={1}>
            {`In ${names.length} ${names.length === 1 ? "deck" : "decks"} · ${names.join(", ")}`}
          </Text>
          <Chevron direction="right" color={palette.faint} size={8} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * The detail pane beside the pool (the Cards hub on a tablet in landscape): the picture at the pane's width, the name, the facts and
 * the decks it is in, scrolling on its own. A tap on another card fills it again; nothing is pushed.
 */
export function CardDetailPane({ code, width }: { code: string; width: number }) {
  const row = useCardRow(code);
  const { preview, intrinsic } = useCardPicture(code, row?.imagesrc ?? null);
  const s = useUiScale();
  if (!row) return <Text className="text-body text-muted">{`Card ${code} is not in the catalog.`}</Text>;
  return (
    <View testID="card-detail-pane">
      {preview && intrinsic ? <CardPicture row={row} preview={preview} intrinsic={intrinsic} width={Math.min(width - 32 * s, 260 * s)} /> : null}
      <View className="mt-5">
        <CardName row={row} size={24} />
      </View>
      <CardFacts row={row} />
      <DeckUse code={row.code} />
    </View>
  );
}

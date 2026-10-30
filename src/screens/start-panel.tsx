import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { PoolCard } from "../campaign/log";
import { FELLOWSHIP_ID } from "../campaign/save";
import type { CampaignData } from "../catalog/scenario-data";
import { GroundedScene } from "./art";
import { Label, PrimaryButton, Segmented, useTitleShadow } from "./chrome";
import { SEAT_WORDS, seatCountOf, seatWord } from "./seats";
import { rowSurface, selectedRingOf, selectedWash } from "../play/surfaces";
import { useUiScale } from "../play/ui-scale";
import { useTableTokens } from "../play/use-table-tokens";
import { useSizeClass } from "../play/use-size-class";
import { Text } from "../play/text";

type Seats = 1 | 2;

// The Fellowship's testIDs are the ones the Maestro flows already use (`seats-1`, `start-fellowship`); every other campaign
// is `seats-<id>-<n>` and `start-<id>`. `campaign-choice-<id>` is a tile of the chooser.
const isFellowship = (id: string): boolean => id === FELLOWSHIP_ID;

// One choice of a group the player picks one from: the silver ring and wash when chosen, a row's surface when not (never the accent
// plate, which is the button's). `min-h-14` keeps the 44 pt target; the words wrap.
function RadioTile({ selected, testID, label, onPress, className, children }: { selected: boolean; testID: string; label: string; onPress: () => void; className: string; children: ReactNode }) {
  const t = useTableTokens();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      className={className.includes("flex-1") ? "flex-1" : undefined}
    >
      {/* The surface is on a view inside: NativeWind drops a style function on a Pressable that also has a className. */}
      {({ pressed }) => (
        <View className={className} style={selected ? { ...rowSurface(false, t), ...selectedWash(t), boxShadow: selectedRingOf(t, 1.5) } : rowSurface(pressed, t)}>
          {children}
        </View>
      )}
    </Pressable>
  );
}

/** What a finished playthrough hands to the next campaign, as the panel offers it. */
export type CarryChoice = { saveId: string; label: string; source: string; words: string; cards: readonly PoolCard[] };

/** A campaign the panel can start. */
export type StartOption = { data: CampaignData; name: string };

/**
 * The start block: one for the whole list, so the screen has one primary button. It sits on the ground with no panel round it. At its top the campaign to start (the scene and
 * the name follow the choice), then the seat count, chosen once for the campaign, then the carry-over of a finished
 * playthrough when there is one to take in (Fresh start is the default), then Start. Every section stays mounted, so the panel
 * keeps its state when one is hidden.
 */
export function StartPanel({ options, carry, onStart }: { options: readonly StartOption[]; carry: readonly CarryChoice[]; onStart: (campaignId: string, seats: Seats, carried: CarryChoice | null) => void }) {
  const s = useUiScale();
  const titleShadow = useTitleShadow();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seats>(1);
  // The playthrough whose carry-over this one takes in, or null for a fresh start.
  const [taking, setTaking] = useState<string | null>(null);
  // In landscape the phone is 390 pt tall: no scene band or heading, and the seats and Start in one row keep
  // Start on the first screen. A short window decides it, not the orientation: a tablet in landscape is tall enough for the portrait layout.
  const { short: landscape } = useSizeClass();
  // Above Medium the landscape layout drops its band and heading and puts the seats and Start in one row (Medium and Small keep the
  // two-column landscape layout): at Large the primary otherwise wraps and starts under the tab bar.
  const compact = landscape && s > 1;
  const chosen = options.find((option) => option.data.id === campaignId) ?? options[0];
  if (!chosen) return null;
  const { data, name } = chosen;
  const taken = carry.find((choice) => choice.saveId === taking) ?? null;
  const seatId = (count: Seats) => (isFellowship(data.id) ? `seats-${count}` : `seats-${data.id}-${count}`);
  const title = (
    <Text className="font-display text-title text-bone" style={titleShadow}>
      {name}
    </Text>
  );
  // In landscape the chooser spans the whole width, so each of three tiles is wide enough for a campaign's name on one line.
  const chooser =
    options.length > 1 ? (
          <View className={landscape ? (compact ? "flex-row gap-2" : "mt-3 flex-row gap-2") : "mt-4 gap-2"} accessibilityRole="radiogroup" accessibilityLabel="Campaign" testID="campaign-choice">
            {options.map((option) => {
              const selected = option.data.id === data.id;
              return (
                <RadioTile
                  key={option.data.id}
                  selected={selected}
                  testID={`campaign-choice-${option.data.id}`}
                  label={`${option.name}, ${option.data.scenarios.length} scenarios`}
                  onPress={() => setCampaignId(option.data.id)}
                  className={landscape ? "min-h-14 flex-1 justify-center rounded-item px-4 py-2" : "min-h-14 justify-center rounded-item px-4 py-3"}
                >
                  <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{option.name}</Text>
                  <Text className="text-label text-faint">{`${option.data.scenarios.length} scenarios`}</Text>
                </RadioTile>
              );
            })}
          </View>
    ) : null;
  // True solo / Two-handed: the stretched switch the standalone briefing's Players uses, its options keeping the `seats-<n>` test ids and
  // each heard with the campaign ("Two-handed, Fellowship of the Ring").
  const seatRow = (
    <>
      <View className={landscape ? undefined : "mt-4"}>
        <Segmented
          options={SEAT_WORDS}
          value={seatWord(seats)}
          onChange={(next) => setSeats(seatCountOf(next))}
          testIDPrefix="seats"
          testIDs={{ "True solo": seatId(1), "Two-handed": seatId(2) }}
          labels={{ "True solo": `${seatWord(1)}, ${name}`, "Two-handed": `${seatWord(2)}, ${name}` }}
          accessibilityLabel={`Players for ${name}`}
          stretch
        />
      </View>
      <Label className="mt-2">{"Can't be changed later."}</Label>
    </>
  );
  const carryOver =
    carry.length > 0 ? (
      <View className="mt-4 gap-2" testID="carry-over">
        <Label>Carry over from a finished campaign</Label>
        <Text className="text-label text-muted">{"The cards join this campaign's pool at its first scenario."}</Text>
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={`Carry-over for ${name}`}>
          <RadioTile selected={taking == null} testID="carry-none" label={`Fresh start, ${name}`} onPress={() => setTaking(null)} className="min-h-touch justify-center rounded-item px-4 py-2">
            <Text className={taking == null ? "text-body font-semibold text-bone" : "text-body text-muted"}>Fresh start</Text>
          </RadioTile>
          {carry.map((choice) => {
            const selected = taking === choice.saveId;
            return (
              <RadioTile
                key={choice.saveId}
                selected={selected}
                testID={`carry-${choice.saveId}`}
                label={`${choice.label}, ${choice.source}: ${choice.words}`}
                onPress={() => setTaking(choice.saveId)}
                className="min-h-touch justify-center rounded-item px-4 py-2"
              >
                <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{choice.label}</Text>
                <Text className="text-label text-faint">{choice.source}</Text>
                <Text className="text-label text-muted">{choice.words}</Text>
              </RadioTile>
            );
          })}
        </View>
      </View>
    ) : null;
  const start = <PrimaryButton label="Start campaign" accessibilityLabel={`Start ${name}`} testID={isFellowship(data.id) ? "start-fellowship" : `start-${data.id}`} onPress={() => onStart(data.id, seats, taken)} />;
  const startPlate = <View className={landscape ? "mt-3" : "mt-4"}>{start}</View>;
  return compact ? (
    // No scene band and no heading: the selected chip already names the campaign and counts its scenarios, and the primary's
    // whole plate must clear the tab bar on a 390 pt tall screen. Seats and Start share one row.
    <View>
      {chooser}
      {carryOver}
      <View className="mt-3 flex-row items-start gap-5">
        <View className="flex-1">{seatRow}</View>
        <View className="flex-1">{start}</View>
      </View>
    </View>
  ) : (
    <View>
      <GroundedScene scenarioId={data.scenarios[0]} height={(landscape ? 48 : 132) * s} fade={0.3} />
      <View style={{ marginTop: (landscape ? -24 : -36) * s }}>
        {landscape ? (
          <>
            {chooser}
            <View className="mt-2 flex-row gap-5">
              <View className="flex-1">{title}</View>
              <View className="flex-1 justify-end">
                {seatRow}
                {carryOver}
                {startPlate}
              </View>
            </View>
          </>
        ) : (
          <>
            {title}
            {chooser}
            {seatRow}
            {carryOver}
            {startPlate}
          </>
        )}
      </View>
    </View>
  );
}

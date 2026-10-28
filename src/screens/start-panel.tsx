import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { PoolCard } from "../campaign/log";
import { FELLOWSHIP_ID } from "../campaign/save";
import type { CampaignData } from "../catalog/scenario-data";
import { SceneArt } from "./art";
import { Label, Panel, PrimaryButton, RingMark } from "./chrome";
import { usePalette } from "./palette-hook";
import { seatWord } from "./seats";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";

type Seats = 1 | 2;

// The Fellowship's testIDs are the ones the Maestro flows already use (`seats-1`, `start-fellowship`); every other campaign
// is `seats-<id>-<n>` and `start-<id>`. `campaign-choice-<id>` is a tile of the chooser.
const isFellowship = (id: string): boolean => id === FELLOWSHIP_ID;

// One choice of a group the player picks one from: a gold edge when chosen, the raised surface when not (never the gold plate,
// which is the button's). `min-h-14` keeps the 44 pt target; the words wrap.
function RadioTile({ selected, testID, label, onPress, className, children }: { selected: boolean; testID: string; label: string; onPress: () => void; className: string; children: ReactNode }) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      className={className}
      style={{ backgroundColor: selected ? palette.pressed : palette.raised, borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.gold : palette.hairline }}
    >
      {children}
    </Pressable>
  );
}

function SeatTile({ seats, name, selected, testID, onPress, compact = false }: { seats: Seats; name: string; selected: boolean; testID: string; onPress: () => void; compact?: boolean }) {
  const label = seatWord(seats);
  const s = useUiScale();
  return (
    <RadioTile selected={selected} testID={testID} label={`${label}, ${name}`} onPress={onPress} className={compact ? "min-h-touch flex-1 flex-row items-center justify-center gap-3 rounded-tile px-3 py-2" : "min-h-14 flex-1 items-center justify-center gap-2 rounded-tile px-3 py-3"}>
      <View className="flex-row">
        <RingMark size={18} state={selected ? "current" : "locked"} />
        {seats === 2 ? (
          <View style={{ marginLeft: -6 * s }}>
            <RingMark size={18} state={selected ? "current" : "locked"} />
          </View>
        ) : null}
      </View>
      <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{label}</Text>
    </RadioTile>
  );
}

/** What a finished playthrough hands to the next campaign, as the panel offers it. */
export type CarryChoice = { saveId: string; label: string; source: string; words: string; cards: readonly PoolCard[] };

/** A campaign the panel can start. */
export type StartOption = { data: CampaignData; name: string };

/**
 * The start panel: one for the whole list, so the screen has one primary button. At its top the campaign to start (the scene and
 * the scenario count follow the choice), then the seat count, chosen once for the campaign, then the carry-over of a finished
 * playthrough when there is one to take in (Fresh start is the default), then Start. Every section stays mounted, so the panel
 * keeps its state when one is hidden.
 */
export function StartPanel({ options, current, carry, onStart }: { options: readonly StartOption[]; current: boolean; carry: readonly CarryChoice[]; onStart: (campaignId: string, seats: Seats, carried: CarryChoice | null) => void }) {
  const palette = usePalette();
  const s = useUiScale();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seats>(1);
  // The playthrough whose carry-over this one takes in, or null for a fresh start.
  const [taking, setTaking] = useState<string | null>(null);
  // In landscape the phone is 390 pt tall: no scene band or heading, compact seat tiles, and the seats and Start in one row keep
  // Start on the first screen. A short window decides it, not the orientation: a tablet in landscape is tall enough for the portrait panel.
  const { short: landscape } = useSizeClass();
  // Above Medium the landscape panel drops its band and heading and puts the seats and Start in one row (Medium and Small keep the
  // two-column landscape layout): at Large the primary otherwise wraps and starts under the tab bar.
  const compact = landscape && s > 1;
  const chosen = options.find((option) => option.data.id === campaignId) ?? options[0];
  if (!chosen) return null;
  const { data, name } = chosen;
  const taken = carry.find((choice) => choice.saveId === taking) ?? null;
  const seatId = (count: Seats) => (isFellowship(data.id) ? `seats-${count}` : `seats-${data.id}-${count}`);
  const count = `${data.scenarios.length} scenarios`;
  const title = (
    <>
      <Text className="font-display text-title text-bone">{name}</Text>
      <Label>{count}</Label>
    </>
  );
  // In landscape the chooser spans the whole panel, so each of three tiles is wide enough for a campaign's name on one line.
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
                  className={landscape ? "min-h-14 flex-1 justify-center rounded-tile px-4 py-2" : "min-h-14 justify-center rounded-tile px-4 py-3"}
                >
                  <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{option.name}</Text>
                  <Text className="text-label text-faint">{`${option.data.scenarios.length} scenarios`}</Text>
                </RadioTile>
              );
            })}
          </View>
    ) : null;
  const seatRow = (
    <>
      <View className={landscape ? "flex-row gap-3" : "mt-4 flex-row gap-3"} accessibilityRole="radiogroup" accessibilityLabel={`Players for ${name}`}>
        <SeatTile compact={landscape} seats={1} name={name} testID={seatId(1)} selected={seats === 1} onPress={() => setSeats(1)} />
        <SeatTile compact={landscape} seats={2} name={name} testID={seatId(2)} selected={seats === 2} onPress={() => setSeats(2)} />
      </View>
      <Label className="mt-2">Chosen once for this campaign</Label>
    </>
  );
  const carryOver =
    carry.length > 0 ? (
      <View className="mt-4 gap-2" testID="carry-over">
        <Label>Carry over from a finished campaign</Label>
        <Text className="text-label text-muted">{"The cards join this campaign's pool at its first scenario."}</Text>
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={`Carry-over for ${name}`}>
          <RadioTile selected={taking == null} testID="carry-none" label={`Fresh start, ${name}`} onPress={() => setTaking(null)} className="min-h-touch justify-center rounded-tile px-4 py-2">
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
                className="min-h-touch justify-center rounded-tile px-4 py-2"
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
  const start = <PrimaryButton label={`Start ${name}`} testID={isFellowship(data.id) ? "start-fellowship" : `start-${data.id}`} onPress={() => onStart(data.id, seats, taken)} />;
  const startPlate = <View className={landscape ? "mt-3" : "mt-4"}>{start}</View>;
  return (
    <Panel current={current} padded={false}>
      {compact ? (
        // No scene band and no heading: the selected chip already names the campaign and counts its scenarios, and the primary's
        // whole plate must clear the tab bar on a 390 pt tall screen. Seats and Start share one row.
        <View className="px-5 pb-5 pt-5">
          {chooser}
          {carryOver}
          <View className="mt-3 flex-row items-start gap-5">
            <View className="flex-1">{seatRow}</View>
            <View className="flex-1">{start}</View>
          </View>
        </View>
      ) : (
        <>
          <View className="overflow-hidden rounded-t-card">
            <SceneArt scenarioId={data.scenarios[0]} height={(landscape ? 48 : 132) * s} fade={0.3} fadeTo={palette.raised} />
          </View>
          <View className="px-5 pb-5" style={{ marginTop: (landscape ? -24 : -36) * s }}>
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
        </>
      )}
    </Panel>
  );
}

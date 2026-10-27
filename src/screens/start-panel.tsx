import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { PoolCard } from "../campaign/log";
import type { CampaignData } from "../catalog/scenario-data";
import { SceneArt } from "./art";
import { Label, Panel, PrimaryButton, RingMark, ToggleChip } from "./chrome";
import { palette } from "./palette.js";
import { seatWord } from "./seats";

type Seats = 1 | 2;

// The Fellowship's testIDs are the ones the Maestro flows already use (`seats-1`, `start-fellowship`); every other campaign
// is `seats-<id>-<n>` and `start-<id>`.
const FELLOWSHIP_ID = "fellowship-of-the-ring";

function SeatTile({ seats, selected, testID, onPress }: { seats: Seats; selected: boolean; testID: string; onPress: () => void }) {
  const label = seatWord(seats);
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-14 flex-1 items-center justify-center gap-2 rounded-tile px-3 py-3"
      style={{ backgroundColor: selected ? palette.pressed : palette.raised, borderWidth: selected ? 1.5 : 1, borderColor: selected ? palette.gold : palette.hairline }}
    >
      <View className="flex-row">
        <RingMark size={18} state={selected ? "current" : "locked"} />
        {seats === 2 ? (
          <View style={{ marginLeft: -6 }}>
            <RingMark size={18} state={selected ? "current" : "locked"} />
          </View>
        ) : null}
      </View>
      <Text className={selected ? "text-body font-semibold text-bone" : "text-body text-muted"}>{label}</Text>
    </Pressable>
  );
}

/** What a finished playthrough hands to the next campaign, as the panel offers it. */
export type CarryChoice = { saveId: string; label: string; words: string; cards: readonly PoolCard[] };

/**
 * The start panel of one playable campaign: its first scene, the seat count, the carry-over of a finished playthrough when there
 * is one to take in (Fresh start is the default), and the button that starts a playthrough.
 */
export function StartPanel({ campaign, name, current, carry, onStart }: { campaign: CampaignData; name: string; current: boolean; carry: readonly CarryChoice[]; onStart: (seats: Seats, carried: readonly PoolCard[]) => void }) {
  const [seats, setSeats] = useState<Seats>(1);
  // The playthrough whose carry-over this one takes in, or null for a fresh start.
  const [taking, setTaking] = useState<string | null>(null);
  const chosen = carry.find((choice) => choice.saveId === taking) ?? null;
  const fellowship = campaign.id === FELLOWSHIP_ID;
  const seatId = (count: Seats) => (fellowship ? `seats-${count}` : `seats-${campaign.id}-${count}`);
  return (
    <Panel current={current} padded={false}>
      <View className="overflow-hidden rounded-t-card">
        <SceneArt scenarioId={campaign.scenarios[0]} height={132} fade={0.3} fadeTo={palette.raised} />
      </View>
      <View className="px-5 pb-5" style={{ marginTop: -36 }}>
        <Text className="font-display text-title text-bone">{name}</Text>
        <Label>{`${campaign.scenarios.length} scenarios`}</Label>
        <View className="mt-4 flex-row gap-3">
          <SeatTile seats={1} testID={seatId(1)} selected={seats === 1} onPress={() => setSeats(1)} />
          <SeatTile seats={2} testID={seatId(2)} selected={seats === 2} onPress={() => setSeats(2)} />
        </View>
        {carry.length > 0 ? (
          <View className="mt-4 gap-2" testID={`carry-${campaign.id}`}>
            <Label>Carry over from a finished campaign</Label>
            <ToggleChip label="Fresh start" selected={taking == null} testID={`carry-none-${campaign.id}`} onPress={() => setTaking(null)} />
            {carry.map((choice) => (
              <ToggleChip key={choice.saveId} label={`${choice.label}: ${choice.words}`} selected={taking === choice.saveId} testID={`carry-${campaign.id}-${choice.saveId}`} onPress={() => setTaking(choice.saveId)} />
            ))}
          </View>
        ) : null}
        <View className="mt-4 gap-3">
          <Label>Chosen once for this campaign</Label>
          <PrimaryButton label={fellowship ? "Start Fellowship" : `Start ${name}`} testID={fellowship ? "start-fellowship" : `start-${campaign.id}`} onPress={() => onStart(seats, chosen?.cards ?? [])} />
        </View>
      </View>
    </Panel>
  );
}

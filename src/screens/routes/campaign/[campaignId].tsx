// The campaign setup screen a campaign tile on the Campaigns hub opens (docs/design-system.md, Campaign setup): the briefing's frame
// over the campaign's first scene, the seat count, the carry-over of a finished playthrough, and Start.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { FELLOWSHIP_ID } from "../../../campaign/save";
import type { ModeCard } from "../../../campaign/xp";
import { BriefingScreen, CampaignBanner, ModePicker } from "../../briefing-parts";
import { campaignListQueries } from "../../campaign-list";
import { campaignOf } from "../../campaign-data";
import { createSave } from "../../campaign-store";
import { useCarryChoices } from "../../carry-choices";
import { BodyText, Label, PrimaryButton, Section, Segmented } from "../../chrome";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { RadioTile } from "../../radio-tile";
import { routeCode } from "../../route-code";
import { pathHref } from "../../scenario-links";
import { SEAT_WORDS, seatCountOf, seatWord } from "../../seats";
import { Text } from "../../../play/text";

export default function CampaignSetup() {
  const router = useRouter();
  const campaignId = routeCode(useLocalSearchParams<{ campaignId: string }>().campaignId);
  const { catalog, user } = useDatabases();
  const [seats, setSeats] = useState<1 | 2>(1);
  // The playthrough whose carry-over this one takes in, or null for a fresh start.
  const [taking, setTaking] = useState<string | null>(null);
  // The Hard/Expert Mode card each briefing offers first, in a campaign with XP (dcce.hard-expert).
  const [mode, setMode] = useState<ModeCard | null>(null);
  const carry = useCarryChoices(catalog, user);
  // Set by the first press, so a second tap before the screen is replaced cannot make another save.
  const started = useRef(false);

  const data = campaignId ? campaignOf(campaignId) : null;
  const row = campaignListQueries(catalog).campaigns.all().find((campaign) => campaign.id === campaignId);
  const frame = { testID: "campaign-setup", backLabel: "Campaigns", backTestID: "campaign-setup-back", barTestID: "start-bar", onBack: () => goBack(router, "/") } as const;
  if (!data || !row?.playable) {
    return (
      <BriefingScreen {...frame} scenarioId={null} banner={null}>
        <BodyText tone="muted" className="mt-4">
          This campaign is not playable yet.
        </BodyText>
      </BriefingScreen>
    );
  }

  const id = data.id;
  const hasXp = data.xp === true;
  const name = row.name;
  const count = data.scenarios.length;
  const words = `${count} ${count === 1 ? "scenario" : "scenarios"}`;
  const taken = carry.find((choice) => choice.saveId === taking) ?? null;
  // The Fellowship's testIDs are the ones the Maestro flows use (`seats-1`, `start-fellowship`); every other campaign is `seats-<id>-<n>` and `start-<id>`.
  const fellowship = id === FELLOWSHIP_ID;
  const seatId = (n: 1 | 2) => (fellowship ? `seats-${n}` : `seats-${id}-${n}`);

  function start(): void {
    if (started.current) return;
    started.current = true;
    const save = createSave(user, id, seats, undefined, taken?.cards ?? [], taken?.saveId ?? null, hasXp ? mode : null);
    router.replace(pathHref(save.id));
  }

  return (
    <BriefingScreen
      {...frame}
      scenarioId={data.scenarios[0] ?? null}
      banner={<CampaignBanner eyebrow={`Campaign · ${words}`} name={name} />}
      bar={
        <View className="gap-2">
          <Label tone="muted" className="text-center">
            {"Can't be changed later."}
          </Label>
          <PrimaryButton label="Start campaign" accessibilityLabel={`Start ${name}, ${words}, ${seatWord(seats)}`} testID={fellowship ? "start-fellowship" : `start-${id}`} onPress={start} />
        </View>
      }
    >
      <Section title="Players" className="mt-4" />
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
      {hasXp ? <ModePicker mode={mode} onMode={setMode} testIDPrefix={`mode-${id}`} /> : null}
      {carry.length > 0 ? (
        <View className="gap-2" testID="carry-over">
          <Section title="Carry over from a finished campaign" className="mt-4" />
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
      ) : null}
    </BriefingScreen>
  );
}

// The campaign setup screen a campaign tile on the Campaigns hub opens (docs/design-system.md, Campaign setup): the briefing's frame
// over the campaign's first scene, the seat count, the carry-over of a finished playthrough, and Start.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { FELLOWSHIP_ID } from "../../../campaign/save";
import { RETURN_OF_THE_KING_CAMPAIGN } from "../../../campaign/saga";
import type { ModeCard } from "../../../campaign/xp";
import { BriefingScreen, CampaignBanner, ModePicker } from "../../briefing/parts";
import { campaignListQueries } from "../../campaign/list";
import { campaignOf } from "../../data/campaign-data";
import { createSave } from "../../data/campaign-store";
import { useCarryChoices } from "../../campaign/carry-choices";
import { BodyText, Label, PrimaryButton, Section, Segmented } from "../../kit/chrome";
import { useDatabases } from "../../data/databases";
import { goBack } from "../../nav/go-back";
import { RadioTile } from "../../kit/radio-tile";
import { routeCode } from "../../nav/route-code";
import { pathHref } from "../../campaign/scenario-links";
import { SEAT_WORDS, seatCountOf, seatWord } from "../../data/seats";
import { Text } from "../../../ui/text";

export default function CampaignSetup() {
  const router = useRouter();
  const campaignId = routeCode(useLocalSearchParams<{ campaignId: string }>().campaignId);
  const { catalog, user } = useDatabases();
  const [seats, setSeats] = useState<1 | 2>(1);
  // The playthrough whose carry-over this one takes in, or null for a fresh start.
  const [taking, setTaking] = useState<string | null>(null);
  // The Hard/Expert Mode card each briefing offers first, in a campaign with XP (dcce.hard-expert).
  const [mode, setMode] = useState<ModeCard | null>(null);
  // The finished save of the box before this one that this save continues, or null (docs/scenarios/the-two-towers.md, The Two Towers).
  const [continuing, setContinuing] = useState<string | null>(null);
  const { carry, continues } = useCarryChoices(catalog, user, campaignId);
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
  const continued = continues.find((choice) => choice.saveId === continuing) ?? null;
  // A continued save takes the finished save's seat count: its log is per seat, and the count is chosen once.
  const seatsNow = continued ? continued.seatCount : seats;
  // The Fellowship's testIDs are the ones the showcase flows use (`seats-1`, `start-fellowship`); every other campaign is `seats-<id>-<n>` and `start-<id>`.
  const fellowship = id === FELLOWSHIP_ID;
  const seatId = (n: 1 | 2) => (fellowship ? `seats-${n}` : `seats-${id}-${n}`);

  function start(): void {
    if (started.current) return;
    started.current = true;
    const save = createSave(user, id, seatsNow, { carried: taken?.cards ?? [], carriedFrom: taken?.saveId ?? null, modeDefault: hasXp ? mode : null, continued: continued?.from ?? null });
    router.replace(pathHref(save.id));
  }

  return (
    <BriefingScreen
      {...frame}
      scenarioId={data.scenarios[0] ?? null}
      campaignSetup={{ id, scenarios: data.scenarios, campaignCards: data.campaignCards }}
      banner={<CampaignBanner eyebrow={`Campaign · ${words}`} name={name} />}
      bar={
        <View className="gap-2">
          <Label tone="muted" className="text-center">
            {"Can't be changed later."}
          </Label>
          <PrimaryButton label="Start campaign" accessibilityLabel={`Start ${name}, ${words}, ${seatWord(seatsNow)}`} testID={fellowship ? "start-fellowship" : `start-${id}`} onPress={start} />
        </View>
      }
    >
      {continues.length > 0 ? (
        <View className="gap-2" testID="continue-saga">
          <Section title="Continue the saga" className="mt-4" />
          <Text className="text-label text-muted">{id === RETURN_OF_THE_KING_CAMPAIGN ? "The heroes, fallen heroes, threat penalties (each player's own included), pool, captives, notes and the enemies under The Black Gate of a finished campaign carry on. The finished campaign is not changed." : "The heroes, fallen heroes, threat penalty, pool, captives and notes of a finished campaign carry on. The finished campaign is not changed."}</Text>
          <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={`Continue the saga in ${name}`}>
            <RadioTile selected={continuing == null} testID="continue-none" label={`Start a new saga, ${name}`} onPress={() => setContinuing(null)} className="min-h-touch justify-center rounded-item px-4 py-2">
              <Text className={continuing == null ? "text-body font-semibold text-bone" : "text-body text-muted"}>Start a new saga</Text>
              <Text className="text-label text-muted">An empty log: no heroes and no captives carried.</Text>
            </RadioTile>
            {continues.map((choice) => {
              const selected = continuing === choice.saveId;
              return (
                <RadioTile
                  key={choice.saveId}
                  selected={selected}
                  testID={`continue-${choice.saveId}`}
                  label={`${choice.label}, ${choice.source}: ${choice.words}`}
                  onPress={() => setContinuing(choice.saveId)}
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
      <Section title="Players" className="mt-4" />
      {continued ? (
        <Text testID="continue-seats" className="text-body text-muted">{`${seatWord(continued.seatCount)}, as in the finished campaign.`}</Text>
      ) : (
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
      )}
      {hasXp ? <ModePicker mode={mode} onMode={setMode} testIDPrefix={`mode-${id}`} campaignName={name} setup /> : null}
      {carry.length > 0 ? (
        <View className="gap-2" testID="carry-over">
          <Section title="Carry over from a finished campaign" className="mt-4" />
          <Text className="text-label text-muted">{"The cards join this campaign's pool at its first scenario."}</Text>
          <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={`Carry-over for ${name}`}>
            <RadioTile selected={taking == null} testID="carry-none" label={`Carry nothing over, ${name}`} onPress={() => setTaking(null)} className="min-h-touch justify-center rounded-item px-4 py-2">
              <Text className={taking == null ? "text-body font-semibold text-bone" : "text-body text-muted"}>Carry nothing over</Text>
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

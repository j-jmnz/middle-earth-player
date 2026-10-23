import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { BodyText, Eyebrow, Panel, RingMark, Screen, ScreenTitle, TextButton } from "../../chrome";
import { campaignListQueries } from "../../campaign-list";
import { useDatabases } from "../../databases";

export default function CampaignList() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const queries = campaignListQueries(catalog, user);
  const campaignRows = queries.campaigns.all();
  const saveRows = queries.saves.all();
  const nameOf = (id: string) => campaignRows.find((campaign) => campaign.id === id)?.name ?? id;

  return (
    <Screen testID="campaign-list" scene="dusk">
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6">
        <View className="pt-6">
          <ScreenTitle>Campaigns</ScreenTitle>
        </View>
        {/* The scene's light sits above the cards. */}
        <View className="mt-48 gap-3">
          {saveRows.length === 0 ? (
            <Panel>
              <BodyText tone="muted">No playthrough exists</BodyText>
            </Panel>
          ) : (
            saveRows.map((save, index) => (
              <Panel key={save.id} current={index === 0}>
                {saveRows.length > 1 && index === 0 ? <Eyebrow>Current</Eyebrow> : null}
                <View className="mt-2 flex-row items-center gap-3">
                  <RingMark size={18} state={index === 0 ? "current" : "locked"} />
                  <Text className="flex-1 font-display text-title text-bone">{nameOf(save.campaignId)}</Text>
                </View>
              </Panel>
            ))
          )}
          {campaignRows.map((campaign) => (
            <View key={campaign.id} className="min-h-14 justify-center border-b border-hairline">
              <Text className="font-display text-body text-bone">{campaign.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View className="items-start pb-safe">
        <TextButton
          label="Debug"
          testID="debug"
          tone="gold"
          onPress={() => {
            router.push("/debug");
          }}
        />
      </View>
    </Screen>
  );
}

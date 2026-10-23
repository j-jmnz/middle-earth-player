import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { BodyText, Screen, ScreenTitle, TextButton } from "../../chrome";
import { campaignListQueries } from "../../campaign-list";
import { useDatabases } from "../../databases";

export default function CampaignList() {
  const router = useRouter();
  const { catalog, user } = useDatabases();
  const queries = campaignListQueries(catalog, user);
  const campaignRows = queries.campaigns.all();
  const saveRows = queries.saves.all();

  return (
    <Screen testID="campaign-list">
      <ScrollView className="min-h-0 flex-1">
        <ScreenTitle>Campaigns</ScreenTitle>
        {campaignRows.map((campaign) => (
          <BodyText key={campaign.id} className="mt-6">
            {campaign.name}
          </BodyText>
        ))}
        {saveRows.length === 0 ? (
          <BodyText tone="muted" className="mt-6">
            No playthrough exists
          </BodyText>
        ) : (
          saveRows.map((save) => (
            <BodyText key={save.id} className="mt-6">
              {save.campaignId}
            </BodyText>
          ))
        )}
      </ScrollView>
      <View className="pb-safe">
        <TextButton
          label="Debug"
          testID="debug"
          onPress={() => {
            router.push("/debug");
          }}
        />
      </View>
    </Screen>
  );
}

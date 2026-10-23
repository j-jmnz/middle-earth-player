import { Text, View } from "react-native";

import { campaignListQueries } from "../../campaign-list";
import { useDatabases } from "../../databases";

export default function CampaignList() {
  const { catalog, user } = useDatabases();
  const queries = campaignListQueries(catalog, user);
  const campaignRows = queries.campaigns.all();
  const saveRows = queries.saves.all();

  return (
    <View
      testID="campaign-list"
      collapsable={false}
      className="flex-1 bg-white px-6 pt-safe dark:bg-black"
    >
      <Text className="text-4xl font-semibold text-black dark:text-white">Campaigns</Text>
      {campaignRows.map((campaign) => (
        <Text
          key={campaign.id}
          className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200"
        >
          {campaign.name}
        </Text>
      ))}
      {saveRows.length === 0 ? (
        <Text className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200">
          No playthrough exists
        </Text>
      ) : (
        saveRows.map((save) => (
          <Text
            key={save.id}
            className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200"
          >
            {save.campaignId}
          </Text>
        ))
      )}
    </View>
  );
}

import { Text, View } from "react-native";

export default function CampaignList() {
  return (
    <View
      testID="campaign-list"
      collapsable={false}
      className="flex-1 bg-white px-6 pt-safe dark:bg-black"
    >
      <Text className="text-4xl font-semibold text-black dark:text-white">Campaigns</Text>
      <Text className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200">
        No campaigns yet
      </Text>
    </View>
  );
}

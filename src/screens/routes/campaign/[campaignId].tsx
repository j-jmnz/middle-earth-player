import { useLocalSearchParams, useRouter } from "expo-router";

import { BodyText, NavBar, Screen } from "../../chrome";
import { goBack } from "../../go-back";

// A stand-in for the campaign setup screen a campaign tile on the hub opens; the real screen replaces it.
export default function CampaignSetup() {
  const router = useRouter();
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  return (
    <Screen testID="campaign-setup" scene="calm">
      <NavBar backLabel="Campaigns" backTestID="campaign-setup-back" onBack={() => goBack(router, "/")} />
      <BodyText>{campaignId}</BodyText>
    </Screen>
  );
}

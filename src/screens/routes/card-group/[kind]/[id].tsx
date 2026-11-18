import { useLocalSearchParams, useRouter } from "expo-router";

import { isGroupKind } from "../../../groups/card-group";
import { CardGroupBody, useCardGroup } from "../../../groups/group-body";
import { NavBar, Screen } from "../../../kit/chrome";
import { goBack } from "../../../nav/go-back";
import { routeCode } from "../../../nav/route-code";
import { useListPreview } from "../../../pool/list-preview";

// One group of cards on its own route (docs/design-system.md, Card groups): an encounter set of the Cards tab's Scenario view, a campaign's
// section of its Campaign view, or the Messenger of the King's heroes. The spoiler ask is in place on first open; Not now goes back. Back says
// "Cards" when the Cards tab opened the group and plain "Back" when a briefing did (its `from` param). A long title takes a second line.
export default function CardGroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind: string; id: string; from?: string }>();
  const kind = routeCode(params.kind);
  const id = routeCode(params.id);
  const fromBriefing = routeCode(params.from) === "briefing";
  const group = useCardGroup(isGroupKind(kind) ? kind : null, id);
  const preview = useListPreview();
  const back = () => goBack(router, "/cards");
  return (
    <Screen scene="calm" testID="card-group">
      <NavBar backLabel={fromBriefing ? "Back" : "Cards"} backTestID="group-back" onBack={back} title={group?.title} subtitle={group?.subtitle} wrap />
      <CardGroupBody group={group} onDecline={back} onPreview={preview.open} />
      {preview.overlay}
    </Screen>
  );
}

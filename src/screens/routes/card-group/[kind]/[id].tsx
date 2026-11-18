import { useLocalSearchParams, useRouter } from "expo-router";

import { isGroupKind } from "../../../groups/card-group";
import { CardGroupBody, useCardGroup } from "../../../groups/group-body";
import { NavBar, Screen } from "../../../kit/chrome";
import { goBack } from "../../../nav/go-back";
import { routeCode } from "../../../nav/route-code";
import { useListPreview } from "../../../pool/list-preview";

// One group of cards on its own route (docs/design-system.md, Card groups): an encounter set of the Cards tab's Scenario view, later a campaign's
// section or the Messenger of the King's heroes. The spoiler ask is in place on first open; Not now goes back.
export default function CardGroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = routeCode(params.kind);
  const id = routeCode(params.id);
  const group = useCardGroup(isGroupKind(kind) ? kind : null, id);
  const preview = useListPreview();
  const back = () => goBack(router, "/cards");
  return (
    <Screen scene="calm" testID="card-group">
      <NavBar backLabel="Cards" backTestID="group-back" onBack={back} title={group?.title} subtitle={group?.subtitle} />
      <CardGroupBody group={group} onDecline={back} onPreview={preview.open} />
      {preview.overlay}
    </Screen>
  );
}

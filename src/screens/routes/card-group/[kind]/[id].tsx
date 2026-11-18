import { useLocalSearchParams, useRouter } from "expo-router";

import { isGroupKind } from "../../../groups/card-group";
import { CardGroupBody, useCardGroup } from "../../../groups/group-body";
import { NavBar, Screen } from "../../../kit/chrome";
import { goBack } from "../../../nav/go-back";
import { routeCode } from "../../../nav/route-code";
import { useListPreview } from "../../../pool/list-preview";

// One group of cards on its own route (docs/design-system.md, Card groups): an encounter set or a campaign's section of the Cards tab's
// Encounter cards view, or one scenario's cards from the campaign setup or a campaign's cards screen. The spoiler ask is in place until the
// player answers it once; Not now goes back. Back says "Cards" when the Cards tab opened the group and plain "Back" when another screen did
// (its `from` param: a briefing, the campaign setup or a campaign's cards). A long title takes a second line.
export default function CardGroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind: string; id: string; from?: string }>();
  const kind = routeCode(params.kind);
  const id = routeCode(params.id);
  const fromCards = routeCode(params.from) == null;
  const group = useCardGroup(isGroupKind(kind) ? kind : null, id);
  const preview = useListPreview();
  const back = () => goBack(router, "/cards");
  return (
    <Screen scene="calm" testID="card-group">
      <NavBar backLabel={fromCards ? "Cards" : "Back"} backTestID="group-back" onBack={back} title={group?.title} subtitle={group?.subtitle} wrap />
      <CardGroupBody group={group} onDecline={back} onPreview={preview.open} />
      {preview.overlay}
    </Screen>
  );
}

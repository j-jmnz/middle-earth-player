// The run history. `kind` (campaign or standalone) is the tab that opened it.
import { useLocalSearchParams } from "expo-router";

import { HistoryView } from "../history-view";
import { routeCode } from "../route-code";

export default function History() {
  const params = useLocalSearchParams<{ kind: string }>();
  return <HistoryView initial={routeCode(params.kind) === "standalone" ? "standalone" : "campaign"} />;
}

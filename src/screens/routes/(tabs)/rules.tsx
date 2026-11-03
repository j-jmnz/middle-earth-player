import { HubHeader } from "../../kit/chrome";
import { RulesView } from "../../rules/view";

// The rules a player reaches for mid-game: the books in the reader, and every rule span searchable by name.
export default function Rules() {
  return <RulesView testID="rules" books header={<HubHeader title="Rules" />} />;
}

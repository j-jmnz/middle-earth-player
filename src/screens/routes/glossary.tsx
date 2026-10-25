import { useRouter } from "expo-router";

import { NavBar } from "../chrome";
import { goBack } from "../go-back";
import { RulesView } from "../rules-view";

// The glossary the table's Rules opens over the game: Back returns to the table where it was.
export default function Glossary() {
  const router = useRouter();
  return <RulesView testID="glossary" books={false} header={<NavBar backLabel="Back" backTestID="glossary-back" onBack={() => goBack(router, "/rules")} />} />;
}

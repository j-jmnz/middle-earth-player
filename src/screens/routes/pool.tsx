import { useLocalSearchParams, useRouter } from "expo-router";

import { CardPool } from "../card-pool";
import { NavBar } from "../chrome";
import { goBack } from "../go-back";

// The pool the deck editor opens to add cards (`adding=1`). Browsing alone is the Cards tab.
export default function DeckPool() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adding?: string | string[] }>();
  const adding = params.adding === "1" || (Array.isArray(params.adding) && params.adding[0] === "1");
  return <CardPool adding={adding} header={<NavBar backLabel="Deck" backTestID="pool-back" onBack={() => goBack(router, "/decks")} />} />;
}

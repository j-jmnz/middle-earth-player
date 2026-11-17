import { useLocalSearchParams, useRouter } from "expo-router";

import { CardPool } from "../pool/card-pool";
import { NavBar } from "../kit/chrome";
import { useDeckDraft } from "../deck/draft";
import { goBack } from "../nav/go-back";

// The pool the deck editor opens to add cards (`adding=1`). Browsing alone is the Cards tab.
export default function DeckPool() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adding?: string | string[]; type?: string | string[] }>();
  const adding = params.adding === "1" || (Array.isArray(params.adding) && params.adding[0] === "1");
  // An empty hero slot opens the pool on heroes; a subsection's Add on its type.
  const startType = typeof params.type === "string" && params.type.length > 0 ? params.type : null;
  const name = useDeckDraft((current) => current.name);
  const side = useDeckDraft((current) => current.target === "side");
  const back = () => goBack(router, "/decks");
  // Adding, the bar names the deck the cards go into.
  const title = adding ? name.trim() || "New deck" : undefined;
  return <CardPool adding={adding} startType={startType} onDone={back} header={<NavBar backLabel="Deck" backTestID="pool-back" onBack={back} title={title} subtitle={adding ? (side ? "Adding to the side deck" : "Adding cards") : undefined} />} />;
}

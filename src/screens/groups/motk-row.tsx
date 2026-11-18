// The Messenger of the King heroes' entry under the Cards tab's switch, in the Player view only (docs/design-system.md, Card groups): one row that
// opens the heroes as a group. They are browse only, so the pool, the adding picker and the deck editor never list them.
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { useDatabases } from "../data/databases";
import { ListRow } from "../kit/chrome";
import { groupDataOf } from "./cache";
import { cardsWord, MOTK_GROUP_ID } from "./card-group";

export function MotkRow() {
  const router = useRouter();
  const { catalog } = useDatabases();
  const count = useMemo(() => groupDataOf(catalog).motk().length, [catalog]);
  if (count === 0) return null;
  return (
    <ListRow
      testID="cards-motk"
      label="Messenger of the King heroes"
      detail={`${cardsWord(count)} · Browse only`}
      onPress={() => router.push({ pathname: "/card-group/[kind]/[id]", params: { kind: "motk", id: MOTK_GROUP_ID } })}
    />
  );
}

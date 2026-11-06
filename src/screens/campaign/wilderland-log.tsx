// The Ered Mithrin columns of the Campaign Log on the campaign path (emce.campaign-log; docs/design-system.md, Campaign path): the encounter cards of the pool under the Pool line, then the
// treasures found, the lines the boon allies were traded for and Beldis's boxes. A group shows once it holds something; the log screen keeps every row.
import { View } from "react-native";

import { copiesMark, encounterSpeech, type WilderlandView } from "../../campaign/wilderland-view";
import { Text } from "../../ui/text";
import { Eyebrow } from "../kit/chrome";
import { CardLines } from "./card-lines";
import { cardSegment, type Line } from "./log-facts";

type Props = { view: WilderlandView; name: (code: string) => string; onCard: (code: string) => void };

/** The encounter cards in the Campaign Pool with their copies, one card to a line, for the place straight under the Pool line. Nothing while the pool holds none. */
export function PoolEncounterLine({ view, name, onCard }: Props) {
  if (view.encounter.length === 0) return null;
  const lines = view.encounter.map((entry): Line => [cardSegment(entry.code, name), { text: copiesMark(entry.copies) }]);
  return (
    <View className="mt-3">
      <Eyebrow header>Encounter cards in the Campaign Pool</Eyebrow>
      <CardLines lines={lines} empty="None." onCard={onCard} testID="path-pool-encounter" className="mt-0.5 text-label text-bone" speech={encounterSpeech(view.encounter, name)} />
    </View>
  );
}

/** The treasures, the allies' lines and Beldis's boxes, each group only once it holds something, each with its own space above. */
export function WilderlandLine({ view, name, onCard }: Props) {
  const beldis = view.beldis.filter((row) => row.used > 0);
  const hasBeldis = beldis.length > 0;
  if (view.treasures.length === 0 && view.lines.length === 0 && !hasBeldis) return null;
  return (
    <View testID="wilderland-line">
      {view.treasures.length > 0 ? (
        <View className="mt-3">
          <Eyebrow header>Treasures</Eyebrow>
          <CardLines lines={view.treasures.map((code): Line => [cardSegment(code, name)])} empty="None discovered." onCard={onCard} testID="path-treasures" className="mt-0.5 text-label text-bone" />
        </View>
      ) : null}
      {view.lines.length > 0 ? (
        <View className="mt-3">
          <Eyebrow header>Unique Allies Protecting Wilderland</Eyebrow>
          <Text testID="path-ally-lines" className="mt-0.5 text-label text-bone">
            {view.lines.map((words) => `${words}.`).join("\n")}
          </Text>
        </View>
      ) : null}
      {hasBeldis ? (
        <View className="mt-3">
          <Eyebrow header>Beldis</Eyebrow>
          <Text testID="path-beldis" className="mt-0.5 text-label text-bone" accessibilityLabel={view.beldis.map((row) => row.speech).join(". ")}>
            {view.beldis.map((row) => `${row.prefix}${row.boxes}`).join("\n")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

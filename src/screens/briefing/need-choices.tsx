// The options of a Campaign Setup choice on a briefing (docs/design-system.md, Briefing): a button for each card or hero pairing, with the card's Action line under it; a long press on one shows the card
// large, as on the Ring-bearer rows.
import { useContext } from "react";
import { View } from "react-native";

import { sphereTell } from "../../play/words/aflame";
import { Label, TextButton } from "../kit/chrome";
import { actionLine } from "./words";
import { OpenCardContext } from "./parts";

type Props = { options: readonly string[]; nameOf: (code: string) => string; printedText: Readonly<Record<string, string | null | undefined>>; onChoose: (option: string) => void };

export function NeedChoices({ options, nameOf, printedText, onChoose }: Props) {
  const openCard = useContext(OpenCardContext);
  return (
    <>
      {options.map((option) => {
    const [code = "", host] = option.split(">");
    const skip = option === "skip";
    const label = skip ? "Skip" : host ? `${nameOf(code)} on ${nameOf(host)}` : `${nameOf(code)}${sphereTell(nameOf(code), printedText[code])}`;
    // The card's Action line, so the choice is made knowing what the boon does.
    const action = skip ? null : actionLine(printedText[code]);
    return (
      <View key={option}>
        <TextButton label={label} testID={`choice-${option}`} onPress={() => onChoose(option)} {...(skip ? {} : { onLongPress: () => openCard(code) })} />
        {action ? (
          <Label tone="muted" className="mb-1 text-center" testID={`choice-${option}-action`}>
            {action}
          </Label>
        ) : null}
      </View>
    );
      })}
    </>
  );
}

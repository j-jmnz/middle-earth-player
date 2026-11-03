// A row's text whose card names open the card's preview when tapped (user request, 2026-11-01): the campaign log's rows and the path's
// pool. Each line is segments (log-facts.ts); a segment with a code is drawn with a dotted underline and is a link to a screen reader.
import { Fragment } from "react";

import { Text } from "../ui/text";
import type { Line } from "./log-facts";

export function CardLines({ lines, empty, onCard, testID, className, speech }: { lines: readonly Line[]; empty: string; onCard: (code: string) => void; testID: string; className: string; speech?: string }) {
  if (lines.length === 0) {
    return (
      <Text testID={testID} className={className}>
        {empty}
      </Text>
    );
  }
  return (
    <Text testID={testID} className={className} {...(speech ? { accessibilityLabel: speech } : {})}>
      {lines.map((line, at) => (
        <Fragment key={at}>
          {at > 0 ? "\n" : null}
          {line.map((segment, index) =>
            segment.code ? (
              <Text
                key={index}
                testID={`${testID}-card-${segment.code}`}
                accessibilityRole="link"
                accessibilityHint="Shows the card"
                onPress={() => onCard(segment.code ?? "")}
                style={{ textDecorationLine: "underline", textDecorationStyle: "dotted" }}
              >
                {segment.text}
              </Text>
            ) : (
              <Fragment key={index}>{segment.text}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </Text>
  );
}


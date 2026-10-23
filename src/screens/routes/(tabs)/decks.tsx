import { BodyText, Screen, ScreenTitle } from "../../chrome";

export default function Decks() {
  return (
    <Screen testID="decks">
      <ScreenTitle>Decks</ScreenTitle>
      <BodyText tone="muted" className="mt-6">
        The deck editor is not in this build.
      </BodyText>
    </Screen>
  );
}

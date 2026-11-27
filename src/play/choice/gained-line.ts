// A card that gives another card an ability prints it as a quoted sentence ("While Mûmak Trail is the active location, it gains: "Response: When
// Mûmak Trail leaves play as an explored location, search the encounter deck ... Shuffle the encounter deck.""). The choice's row for that
// Response says what the Response does, not who gains it: the row's label names the card and its timing already.

const GAINED = /\bgains?:\s*["“]\s*(?:Response|Action|Forced|Travel|Shadow|Quest Action|Combat Action|Valour [A-Za-z]+|Planning Action|Resource Action|Refresh Action):\s*([\s\S]*?)["”]\.?$/;

/** The sentence a printed "... it gains: "Response: <sentence>"" line gives the ability, or the line itself when it is no such line. */
export function gainedSentence(line: string): string {
  return GAINED.exec(line.trim())?.[1]?.trim() ?? line;
}

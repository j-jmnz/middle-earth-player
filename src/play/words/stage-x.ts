// What the preview says of a card whose Threat, Attack or Defense is read from the stage number of the main quest (Rider of Mirkwood, Forest Grove, The Two Watchers, Sauron's Enforcers). The engine decided the number; this only says it.

/** One stat the stage number sets: its name, the number it has now, and how the record builds it from the stage number. */
export type StageStat = { readonly name: string; readonly value: number; readonly times: number; readonly plus: number };

// How a stat is built from the stage number: "the stage number", "twice the stage number", "the stage number plus 1".
const howWords = (one: StageStat): string => {
  const base = one.times === 1 ? "the stage number" : one.times === 2 ? "twice the stage number" : `the stage number times ${one.times}`;
  return one.plus === 0 ? base : `${base}${one.plus > 0 ? " plus " : " minus "}${Math.abs(one.plus)}`;
};

/** The preview line: "X is the stage number" for a bare stat, the sum for any other, and each number now. */
export const stageXWords = (values: readonly StageStat[], staged: boolean): string => {
  const note = staged ? "" : " (no stage in play)";
  const bare = values.filter((one) => one.times === 1 && one.plus === 0);
  const built = values.filter((one) => !(one.times === 1 && one.plus === 0));
  const first = bare.length > 0 ? [`X is the stage number of the main quest${note}: ${bare.map((one) => `${one.name} ${one.value}`).join(", ")} now.`] : [];
  const rest = built.map((one) => `${one.name} is ${howWords(one)} of the main quest${note}: ${one.value} now.`);
  return [...first, ...rest].join(" ");
};

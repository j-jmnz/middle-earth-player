// The face a text is drawn in (docs/design-system.md, Type): the body face, Barlow Semi Condensed, unless the class asks for the display face
// (`font-display`, Marcellus SC), and the two things that change it. iOS Bold Text draws the body face one Barlow weight heavier (400 to 600,
// 600 to 700, 700 stays: React Native does not bold a custom font by itself). The Title face setting draws every `font-display` text in Barlow
// semibold (Plain) instead of Marcellus SC (Carved). Pure, so a test reads it; text.tsx applies it.

export type FaceOptions = { bold: boolean; plain: boolean };

const WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
// The next file up: Barlow has 400, 600 and 700. An unnamed or medium weight draws the 400 file, so one up is semibold; semibold goes to bold.
const HEAVIER: Readonly<Record<string, string>> = { semibold: "bold", bold: "bold" };

/** The class list with its face classes decided: body unless display, plain titles as Barlow semibold, Bold Text one weight up. */
export function faceClass(className: string | undefined, options: FaceOptions): string {
  const display = className?.split(/\s+/).includes("font-display") === true;
  if (!options.bold && !(display && options.plain)) {
    if (display) return className ?? "";
    return className ? `font-body ${className}` : "font-body";
  }
  if (display && !options.plain) return className ?? "";
  const rest = (className ? className.split(/\s+/).filter(Boolean) : []).filter((token) => token !== "font-display");
  const named = rest.find((token) => WEIGHT.test(token))?.slice(5) ?? (display ? "semibold" : "normal");
  // Barlow's italic has one file, so an italic text keeps its weight.
  const heavier = options.bold && !rest.includes("italic") ? (HEAVIER[named] ?? "semibold") : named;
  const others = rest.filter((token) => !WEIGHT.test(token));
  return ["font-body", ...(heavier === "normal" ? [] : [`font-${heavier}`]), ...others].join(" ");
}

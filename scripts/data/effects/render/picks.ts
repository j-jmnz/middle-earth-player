// Pick filters: the noun phrase a Pick, a count or a holder names ("enemy in play (any player) named \"Urdug\""). `src/catalog/effect-schema-pick.ts` owns the keys.
import { done, isObj, joinAnd, jsonOf, quoted, str, type Ctx, type Obj } from "./kit.ts";

export type PickRenderer = (pick: unknown, ctx: Ctx) => string;

const CONTROL: Readonly<Record<string, string>> = { you: "you control", any: "any player controls", other: "another player controls" };
const FROM: Readonly<Record<string, string>> = { play: "in play", hand: "in hand", discard: "in the discard pile", deck: "in the deck", victory: "in the victory display", loot: "in the loot pile", encounterDeck: "in the encounter deck" };
const ENGAGED: Readonly<Record<string, string>> = { you: "engaged with you", other: "engaged with another player" };

// Each entry reads some keys and says one qualifier; the order is the order the phrase reads in. A key whose value says nothing (`committed: false` before it had words) is not claimed, so it prints after the text as `[also {...}]`.
type Part = { keys: readonly string[]; say: (pick: Obj) => string | null };
const PARTS: readonly Part[] = [
  { keys: ["state"], say: (p) => (typeof p.state === "string" ? p.state : null) },
  { keys: ["sphere"], say: (p) => (typeof p.sphere === "string" ? p.sphere : null) },
  { keys: ["spheres"], say: (p) => (Array.isArray(p.spheres) ? p.spheres.map(str).join("/") : null) },
  { keys: ["unique"], say: (p) => (p.unique === true ? "unique" : null) },
  { keys: ["nonUnique"], say: (p) => (p.nonUnique === true ? "non-unique" : null) },
  { keys: ["trait"], say: (p) => (typeof p.trait === "string" ? p.trait : null) },
  { keys: ["traits"], say: (p) => (Array.isArray(p.traits) ? p.traits.map(str).join(" or ") : null) },
  { keys: ["damaged"], say: (p) => (p.damaged === true ? "damaged" : p.damaged === false ? "undamaged" : null) },
];

export const renderPick: PickRenderer = (value, ctx) => {
  if (!isObj(value) || typeof value.type !== "string") return jsonOf(ctx, "pick", value);
  const pick = value;
  const read = ["type", "control"];
  const claim = (keys: readonly string[], text: string | null): void => {
    if (text !== null || keys.every((key) => pick[key] === undefined)) read.push(...keys);
  };
  const front = PARTS.flatMap((part) => {
    const said = part.say(pick);
    claim(part.keys, said);
    return said ? [said] : [];
  });
  const after: string[] = [];
  const note = (keys: readonly string[], text: string | null): void => {
    claim(keys, text);
    if (text) after.push(text);
  };
  note(["from"], typeof pick.from === "string" ? (FROM[pick.from] ?? pick.from) : null);
  note(["top"], typeof pick.top === "number" ? `among the top ${pick.top}` : null);
  note(["bottom"], typeof pick.bottom === "number" ? `among the bottom ${pick.bottom}` : null);
  note(["staging"], pick.staging === true ? "or in the staging area" : null);
  note(["stagingOnly"], pick.stagingOnly === true ? "in the staging area only" : null);
  note(["engaged"], typeof pick.engaged === "string" ? (ENGAGED[pick.engaged] ?? pick.engaged) : null);
  note(["names"], Array.isArray(pick.names) ? `named ${quoted(pick.names)}` : null);
  note(["exceptNames"], Array.isArray(pick.exceptNames) ? `not named ${quoted(pick.exceptNames)}` : null);
  note(["notTraits"], Array.isArray(pick.notTraits) ? `without ${joinAnd(pick.notTraits.map(str))}` : null);
  note(["nonObjective"], pick.nonObjective === true ? "that is not an objective" : null);
  note(["objective"], pick.objective === true ? "that is an objective" : null);
  note(["cardType"], typeof pick.cardType === "string" ? `of card type ${pick.cardType}` : null);
  note(["committed"], pick.committed === true ? "committed to the quest" : pick.committed === false ? "not committed to the quest" : null);
  note(["attacking"], pick.attacking === true ? "attacking" : null);
  note(["defending"], pick.defending === true ? "defending" : null);
  note(["hasResources"], pick.hasResources === true ? "with resources on it" : null);
  note(["progress"], pick.progress === true ? "with progress on it" : pick.progress === false ? "with no progress on it" : null);
  note(["captive"], typeof pick.captive === "string" ? (pick.captive === "only" ? "that is a Captive (held by an enemy or lying free)" : pick.captive === "free" ? "that is a Captive that no enemy holds" : "(Captives included)") : null);
  note(["exceptSphere"], typeof pick.exceptSphere === "string" ? `that is not a ${pick.exceptSphere} card` : null);
  note(["who"], pick.who === "firstPlayer" ? "chosen by the first player" : null);
  note(["engagedEnemies"], pick.engagedEnemies === true ? "(enemies engaged with a player included)" : null);
  note(["hasShadow"], pick.hasShadow === true ? "with a shadow card" : null);
  // A Captive is in play but no player controls it (families/captives owns "Captives are in play but are not under any player's control", 143022:A:1).
  const control = pick.captive === "only" || pick.captive === "free" ? "in play, controlled by no player" : typeof pick.control === "string" ? (CONTROL[pick.control] ?? pick.control) : "";
  const noun = [...front, str(pick.type)].join(" ");
  const text = `${noun} (${control})${after.length > 0 ? ` ${after.join(", ")}` : ""}`;
  return done(ctx, text, pick, read);
};

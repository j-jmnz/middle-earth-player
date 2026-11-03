// Which game icon stands for which word the app shows: a sphere, a card type, a stat. The icons themselves are in
// ./icons/generated.ts (written by pnpm data:build; docs/design-system.md, Icons). Pure data, so tests read it in Node.
import { ICONS, type IconName } from "./icons/generated.ts";

export type { IconName };

// The seven spheres, as RingsDB names them in the catalog.
const SPHERES: Readonly<Record<string, IconName>> = {
  leadership: "leadership",
  tactics: "tactics",
  spirit: "spirit",
  lore: "lore",
  fellowship: "fellowship",
  baggins: "baggins",
  neutral: "neutral",
};

// Player card types that print a type icon. Encounter types (enemy, location, treachery, objective, quest) do not, and
// stay words.
const TYPES: Readonly<Record<string, IconName>> = {
  hero: "hero",
  ally: "ally",
  attachment: "attachment",
  event: "event",
  treasure: "treasure",
  "player-side-quest": "playerSideQuest",
  contract: "contract",
};

export function sphereIcon(sphere: string | null | undefined): IconName | null {
  return sphere ? (SPHERES[sphere] ?? null) : null;
}

export function typeIcon(type: string | null | undefined): IconName | null {
  return type ? (TYPES[type] ?? null) : null;
}

/** Width over height of an icon: a vector's viewBox, a raster's pixels. */
export function iconAspect(name: IconName): number {
  const icon = ICONS[name];
  return icon.kind === "vector" ? icon.viewBox[2] / icon.viewBox[3] : icon.width / icon.height;
}

// The design-system token each one-colour icon is tinted with. Sphere icons keep the sphere colours sampled from the printed
// icons; the token-art PNGs (quest points, engagement cost) are full colour and are not tinted.
export const SPHERE_TINT: Readonly<Record<string, "leadership" | "tactics" | "spirit" | "lore" | "fellowship" | "faint">> = {
  leadership: "leadership",
  tactics: "tactics",
  spirit: "spirit",
  lore: "lore",
  fellowship: "fellowship",
  baggins: "fellowship",
  neutral: "faint",
};

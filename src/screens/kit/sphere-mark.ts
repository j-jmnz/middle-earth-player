export type MarkedSphere = "leadership" | "tactics" | "spirit" | "lore" | "fellowship" | "baggins" | "neutral";

export function markedSphere(sphere: string | null): MarkedSphere | null {
  if (
    sphere === "leadership" ||
    sphere === "tactics" ||
    sphere === "spirit" ||
    sphere === "lore" ||
    sphere === "fellowship" ||
    sphere === "baggins" ||
    sphere === "neutral"
  ) {
    return sphere;
  }
  return null;
}

export function sphereWord(sphereName: string | null | undefined): string {
  if (sphereName && sphereName.length > 0) return sphereName;
  return "Neutral";
}

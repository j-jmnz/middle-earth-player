// A few rows for the group tests: the shape groups/cache.ts reads, with the defaults a test rarely cares about.
import type { GroupRow } from "./group-types";

export function row(over: Partial<GroupRow> & Pick<GroupRow, "code" | "name" | "typeCode">): GroupRow {
  return {
    typeName: over.typeCode,
    packCode: "Core",
    packCodes: [over.packCode ?? "Core"],
    position: Number(over.code) || 1,
    encounterSet: null,
    quantity: 1,
    campaignKind: null,
    burdenSet: null,
    campaignId: null,
    imagesrc: null,
    ...over,
  };
}

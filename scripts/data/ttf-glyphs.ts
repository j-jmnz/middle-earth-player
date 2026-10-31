// Cuts simple glyph outlines out of a TrueType font as SVG path data in font units, y up (the convention scripts/data/icons.ts
// uses for the RingsDB glyphs). Only what the MEC111 icon subset needs: no composite glyphs, no hinting, no cmap.
function tables(view: DataView): Map<string, { offset: number; length: number }> {
  const count = view.getUint16(4);
  const map = new Map<string, { offset: number; length: number }>();
  for (let at = 0; at < count; at += 1) {
    const entry = 12 + at * 16;
    let tag = "";
    for (let char = 0; char < 4; char += 1) tag += String.fromCharCode(view.getUint8(entry + char));
    map.set(tag, { offset: view.getUint32(entry + 8), length: view.getUint32(entry + 12) });
  }
  return map;
}

type Point = { x: number; y: number; on: boolean };

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function contourPath(points: readonly Point[]): string {
  // The start is an on-curve point: the first one, or the midpoint of two off-curve neighbours.
  let start = points.findIndex((point) => point.on);
  let rotated: Point[];
  if (start >= 0) {
    rotated = [...points.slice(start), ...points.slice(0, start)];
  } else {
    const first = points[0] as Point;
    const last = points[points.length - 1] as Point;
    rotated = [{ x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, on: true }, ...points];
    start = 0;
  }
  const first = rotated[0] as Point;
  const out = [`M${round(first.x)} ${round(first.y)}`];
  let control: Point | null = null;
  for (const point of [...rotated.slice(1), first]) {
    if (!point.on) {
      if (control) {
        const mid = { x: (control.x + point.x) / 2, y: (control.y + point.y) / 2 };
        out.push(`Q${round(control.x)} ${round(control.y)} ${round(mid.x)} ${round(mid.y)}`);
      }
      control = point;
    } else if (control) {
      out.push(`Q${round(control.x)} ${round(control.y)} ${round(point.x)} ${round(point.y)}`);
      control = null;
    } else {
      out.push(`L${round(point.x)} ${round(point.y)}`);
    }
  }
  out.push("Z");
  return out.join("");
}

/** The outline of glyph `index` as path data (absolute M, L, Q, Z), and its advance-free box is left to the caller. */
export function glyphPath(font: Uint8Array, index: number): string {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const found = tables(view);
  const head = found.get("head");
  const loca = found.get("loca");
  const glyf = found.get("glyf");
  if (!head || !loca || !glyf) throw new Error("The font has no head, loca or glyf table");
  // The glyph must exist: a wrong index would read the next glyph's outline, or past the table.
  const maxp = found.get("maxp");
  if (!maxp) throw new Error("The font has no maxp table");
  const glyphs = view.getUint16(maxp.offset + 4);
  if (!Number.isInteger(index) || index < 0 || index >= glyphs) throw new Error(`Glyph ${index} is not in the font (${glyphs} glyphs)`);
  const long = view.getInt16(head.offset + 50) === 1;
  const offsetAt = (glyph: number) => (long ? view.getUint32(loca.offset + glyph * 4) : view.getUint16(loca.offset + glyph * 2) * 2);
  const begin = glyf.offset + offsetAt(index);
  if (offsetAt(index + 1) === offsetAt(index)) return "";
  const contours = view.getInt16(begin);
  if (contours < 0) throw new Error(`Glyph ${index} is composite`);
  const ends = Array.from({ length: contours }, (_, at) => view.getUint16(begin + 10 + at * 2));
  const total = (ends[ends.length - 1] ?? -1) + 1;
  let cursor = begin + 10 + contours * 2;
  cursor += 2 + view.getUint16(cursor);
  const flags: number[] = [];
  while (flags.length < total) {
    const flag = view.getUint8(cursor);
    cursor += 1;
    flags.push(flag);
    if (flag & 8) {
      const repeat = view.getUint8(cursor);
      cursor += 1;
      for (let again = 0; again < repeat; again += 1) flags.push(flag);
    }
  }
  const axis = (short: number, same: number): number[] => {
    const values: number[] = [];
    let value = 0;
    for (const flag of flags) {
      if (flag & short) {
        const delta = view.getUint8(cursor);
        cursor += 1;
        value += flag & same ? delta : -delta;
      } else if (!(flag & same)) {
        value += view.getInt16(cursor);
        cursor += 2;
      }
      values.push(value);
    }
    return values;
  };
  const xs = axis(2, 16);
  const ys = axis(4, 32);
  const points: Point[] = flags.map((flag, at) => ({ x: xs[at] ?? 0, y: ys[at] ?? 0, on: (flag & 1) === 1 }));
  let from = 0;
  const paths: string[] = [];
  for (const end of ends) {
    paths.push(contourPath(points.slice(from, end + 1)));
    from = end + 1;
  }
  return paths.join("");
}

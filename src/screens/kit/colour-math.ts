// Colour maths for the palette tests: WCAG luminance (contrast.test.ts) and colour-vision simulation with CIEDE2000 (colour-vision.test.ts).
// Pure functions of a "#RRGGBB" string; nothing here is drawn.
export type Rgb = readonly [r: number, g: number, b: number];
export type Lab = readonly [l: number, a: number, b: number];

/** The sRGB channels of "#RRGGBB" as linear light, 0 to 1. */
export function linearRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(16), channel(8), channel(0)];
}

/** WCAG 2.x relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = linearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type Deficiency = "protanopia" | "deuteranopia" | "tritanopia";

// Machado, Oliveira and Fernandes 2009, "A Physiologically-based Model for Simulation of Color Vision Deficiency", severity 1.0, applied to linear RGB.
const MACHADO: Readonly<Record<Deficiency, readonly [Rgb, Rgb, Rgb]>> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The colour as the deficiency sees it, in linear light. */
export function simulate(hex: string, deficiency: Deficiency): Rgb {
  const rgb = linearRgb(hex);
  const [r, g, b] = MACHADO[deficiency].map((row) => clamp01(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]));
  return [r!, g!, b!];
}

/** Linear sRGB to CIE Lab (D65). */
export function toLab([r, g, b]: Rgb): Lab {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

/** CIEDE2000 (Sharma, Wu and Dalal 2005), kL = kC = kH = 1. */
export function deltaE2000(one: Lab, two: Lab): number {
  const [l1, a1, b1] = one;
  const [l2, a2, b2] = two;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (deg(Math.atan2(b, a)) + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = l2 - l1;
  const dCp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp / 2));
  const lMean = (l1 + l2) / 2;
  const cpMean = (c1p + c2p) / 2;
  let hpMean = h1p + h2p;
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hpMean /= 2;
    else hpMean = (hpMean + (hpMean < 360 ? 360 : -360)) / 2;
  }
  const t = 1 - 0.17 * Math.cos(rad(hpMean - 30)) + 0.24 * Math.cos(rad(2 * hpMean)) + 0.32 * Math.cos(rad(3 * hpMean + 6)) - 0.2 * Math.cos(rad(4 * hpMean - 63));
  const dTheta = 30 * Math.exp(-(((hpMean - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cpMean;
  const sh = 1 + 0.015 * cpMean * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;
  return Math.sqrt((dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh));
}

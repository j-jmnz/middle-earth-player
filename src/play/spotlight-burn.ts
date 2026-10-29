// The burn of a destroyed target (docs/plans/combat-spotlight-redesign.md, §4): a noise-threshold dissolve with an ember rim. The
// field is 2-octave value noise over the card (0 at the top-left, 1 at the bottom-right of its rectangle), leaning so the fire
// climbs from the foot; a pixel is gone once the threshold passes its field value. `burnField` is the field in TypeScript and `BURN_SKSL`
// is the same field in SkSL, both built from the constants below, so the ash that rises where the front passes
// (spotlight-particles.ts) is born in the order the shader burns. Pure and worklet-safe; the native layer compiles the SkSL
// (`Skia.RuntimeEffect.Make`) and falls back to a fade when that fails.

/** The shared constants: the lattice size of each octave, the weight of the second, the lean from the foot, the rim's width and the hash. */
export const BURN = {
  cells: [4, 9],
  weight: [0.62, 0.38],
  // How much of the field is the lean from the foot (1 at the top of the card, 0 at its foot), so the foot burns first.
  lean: 0.28,
  // The band, in field units, behind the front that glows as the rim, and the hash of a lattice point.
  rim: 0.14,
  // The hash of a lattice point (Hoskins' hash without sine: small numbers throughout, so a GPU's float32 agrees with TypeScript's
  // float64 to within about 0.005 of the field), and how far a seed moves the lattice. A seed is taken modulo `seeds`.
  hashScale: [0.1031, 0.103],
  hashShift: 4.37,
  seedStep: [1.7, 2.3],
  seeds: 16,
  // The rim's colors: hot at the front, ember behind it (linear RGB), and how dark the char behind the rim goes.
  hot: [1.0, 0.78, 0.3],
  ember: [0.86, 0.2, 0.05],
  char: 0.3,
} as const;

function fract(x: number): number {
  "worklet";
  return x - Math.floor(x);
}

/** The seed the field is made with: the plan's seed folded to `BURN.seeds` values (the shader's `seed` uniform is this). */
export function burnSeed(seed: number): number {
  "worklet";
  return ((Math.floor(seed) % BURN.seeds) + BURN.seeds) % BURN.seeds;
}

// A lattice point's value in [0, 1).
function lattice(ix: number, iy: number, seed: number): number {
  "worklet";
  const x = fract((ix + seed * BURN.seedStep[0]) * BURN.hashScale[0]);
  const y = fract((iy + seed * BURN.seedStep[1]) * BURN.hashScale[1]);
  const d = x * (y + BURN.hashShift) + y * (x + BURN.hashShift) + x * (x + BURN.hashShift);
  return fract((x + y + 2 * d) * (x + d));
}

// Value noise at a point of one octave: the lattice values blended by a smoothstep, in [0, 1].
function octave(x: number, y: number, seed: number): number {
  "worklet";
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lattice(ix, iy, seed) + (lattice(ix + 1, iy, seed) - lattice(ix, iy, seed)) * sx;
  const bottom = lattice(ix, iy + 1, seed) + (lattice(ix + 1, iy + 1, seed) - lattice(ix, iy + 1, seed)) * sx;
  return top + (bottom - top) * sy;
}

/** The burn field at a point of the card (`u`, `v` in 0..1) for a seed: in [0, 1], low where the card burns first. */
export function burnField(u: number, v: number, plan: number): number {
  "worklet";
  const seed = burnSeed(plan);
  const noise = BURN.weight[0] * octave(u * BURN.cells[0], v * BURN.cells[0], seed) + BURN.weight[1] * octave(u * BURN.cells[1], v * BURN.cells[1] + 31.7, seed + 3);
  return (1 - BURN.lean) * noise + BURN.lean * (1 - v);
}

/** The threshold the shader burns to for a dissolve of `d` (0..1): past the whole field and its rim at 1. */
export function burnThreshold(d: number): number {
  "worklet";
  return d * (1 + BURN.rim);
}

/** How far through the dissolve (0..1) the front reaches a pixel of this field value. */
export function burnFront(field: number): number {
  "worklet";
  return Math.sqrt(Math.min(1, Math.max(0, field / (1 + BURN.rim))));
}

/** The indices of these card cells in the order the burn front reaches them, earliest first (ties by index): the order ash is born in. */
export function ashOrder(cells: readonly { u: number; v: number }[], seed: number): number[] {
  const value = (i: number) => burnField(cells[i]?.u ?? 0, cells[i]?.v ?? 0, seed);
  return cells.map((_, i) => i).sort((a, b) => value(a) - value(b) || a - b);
}

const f = (x: number) => (Number.isInteger(x) ? `${x}.0` : String(x));
const v3 = (c: readonly number[]) => `float3(${c.map(f).join(", ")})`;

/**
 * The SkSL of the burn, for a RuntimeShader image filter on the target's layer: `image` is the layer, `rect` the card's rectangle in
 * the layer's pixels (x, y, width, height), `threshold` is `burnThreshold(dissolve)` and `seed` is `burnSeed(plan.seed)`.
 */
export const BURN_SKSL = `
uniform shader image;
uniform float4 rect;
uniform float threshold;
uniform float seed;

float lattice(float2 p, float s) {
  float x = fract((p.x + s * ${f(BURN.seedStep[0])}) * ${f(BURN.hashScale[0])});
  float y = fract((p.y + s * ${f(BURN.seedStep[1])}) * ${f(BURN.hashScale[1])});
  float d = x * (y + ${f(BURN.hashShift)}) + y * (x + ${f(BURN.hashShift)}) + x * (x + ${f(BURN.hashShift)});
  return fract((x + y + 2.0 * d) * (x + d));
}

float octave(float2 p, float s) {
  float2 i = floor(p);
  float2 q = p - i;
  float2 w = q * q * (3.0 - 2.0 * q);
  float top = mix(lattice(i, s), lattice(i + float2(1.0, 0.0), s), w.x);
  float bottom = mix(lattice(i + float2(0.0, 1.0), s), lattice(i + float2(1.0, 1.0), s), w.x);
  return mix(top, bottom, w.y);
}

float field(float2 uv) {
  float noise = ${f(BURN.weight[0])} * octave(uv * ${f(BURN.cells[0])}, seed) + ${f(BURN.weight[1])} * octave(uv * ${f(BURN.cells[1])} + float2(0.0, 31.7), seed + 3.0);
  return ${f(1 - BURN.lean)} * noise + ${f(BURN.lean)} * (1.0 - uv.y);
}

half4 main(float2 xy) {
  half4 c = image.eval(xy);
  float d = field((xy - rect.xy) / rect.zw) - threshold;
  if (d < 0.0) return half4(0.0);
  float band = 1.0 - smoothstep(0.0, ${f(BURN.rim)}, d);
  half3 glow = half3(mix(${v3(BURN.ember)}, ${v3(BURN.hot)}, band * band));
  half3 charred = c.rgb * half(mix(${f(BURN.char)}, 1.0, smoothstep(0.0, ${f(BURN.rim * 2)}, d)));
  half3 rgb = mix(charred, glow * c.a, half(band));
  return half4(rgb, c.a);
}
`;

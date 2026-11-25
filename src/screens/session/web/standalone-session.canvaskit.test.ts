// The scene variant of the standalone session (standalone-session.canvaskit.ts) answers only in the e2e-test build. Without the seed, a page that carries a scene still opens the scene game id by the ordinary path.
import { afterEach, describe, expect, it, vi } from "vitest";

const phoneStore = vi.fn(() => "phone-store");
const phoneAfterPaint = vi.fn((gameId: string | null) => (gameId === null ? null : "phone-session"));

vi.mock("../standalone-session", () => ({ useStandaloneSessionAfterPaint: phoneAfterPaint, standaloneStore: phoneStore }));
vi.mock("../../data/databases", () => ({ useDatabases: () => ({ catalog: {} }) }));
vi.mock("../../../play/store/store", () => ({ createTableStore: () => "scene-store" }));
vi.mock("../play-clock", () => ({ createPlayClock: () => "clock" }));
vi.mock("../open-game", () => ({ factsOf: () => new Map() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  phoneStore.mockClear();
  phoneAfterPaint.mockClear();
});

async function variant(seed: string) {
  vi.stubEnv("EXPO_PUBLIC_E2E_SEED", seed);
  vi.stubGlobal("__E2E_SCENE__", { scenarioId: "the-morgul-vale", state: {}, cards: [], extraEffects: [] });
  vi.resetModules();
  return import("./standalone-session.canvaskit");
}

describe("the scene variant of the standalone session", () => {
  it("opens nothing and takes the ordinary path without the e2e seed", async () => {
    const { useStandaloneSessionAfterPaint, standaloneStore } = await variant("");
    expect(useStandaloneSessionAfterPaint("standalone-e2e-scene")).toBe("phone-session");
    expect(phoneAfterPaint).toHaveBeenCalledWith("standalone-e2e-scene", 0);
    const session = { ok: true, stored: { id: "standalone-e2e-scene" } } as unknown as Parameters<typeof standaloneStore>[0];
    expect(standaloneStore(session, undefined as never)).toBe("phone-store");
    expect(phoneStore).toHaveBeenCalledTimes(1);
  });
});

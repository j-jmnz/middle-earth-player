// The phone's Saves page (src/screens/settings/phone-backup-run.ts) over in-memory databases and a stand-in for the phone's file calls: a backup is handed over whole,
// a restore puts it back and starts the app again, and a closed sheet or a refused file changes nothing (docs/brief.md, Persistence and shipping).
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { describe, expect, it, vi } from "vitest";

import migrations from "../../../drizzle/migrations";
import { drizzleOf, openMemory } from "../../../test/harness/sqlite-async";
import { createSave } from "../data/campaign-store";
import { backUp, pickBackup, restore, type PhoneIo, type Picked } from "./phone-backup-run";

vi.mock("expo-sqlite", async () => ({ deserializeDatabaseAsync: (await import("../../../test/harness/sqlite-async")).deserializeDatabaseAsync }));
vi.mock("drizzle-orm/expo-sqlite", async () => ({ drizzle: (await import("../../../test/harness/sqlite-async")).drizzleOf }));

async function open(seats: 1 | 2) {
  const client = openMemory();
  const db = drizzleOf(client);
  await migrate(db as never, migrations as never);
  const save = createSave(db as never, "fellowship-of-the-ring", seats, { now: 1000 });
  return { client, db, saveId: save.id };
}

const saveIds = (client: ReturnType<typeof openMemory>): string[] => (client.raw.prepare("SELECT id FROM saves ORDER BY id").all() as { id: string }[]).map((row) => row.id);

function io(over: Partial<PhoneIo> = {}): PhoneIo & { handed: Picked[]; reloads: number } {
  const state = { handed: [] as Picked[], reloads: 0 };
  return Object.assign(state, {
    hand: async (bytes: Uint8Array, name: string) => {
      state.handed.push({ bytes, name });
      return "shared" as const;
    },
    pick: async () => null,
    reload: () => {
      state.reloads += 1;
    },
    ...over,
  });
}

const NOW = new Date(2026, 10, 23);

describe("the phone's backup", () => {
  it("hands the whole database over under the dated name and says so", async () => {
    const { db } = await open(1);
    const phone = io();
    const said = await backUp(db as never, NOW, phone);
    expect(phone.handed.map((each) => each.name)).toEqual(["middle-earth-player-2026-11-23.backup"]);
    expect(said).toEqual({ text: "middle-earth-player-2026-11-23.backup is ready. It holds every campaign, game, deck and run on this device.", failed: false });
  });

  it("says saved when the file went into a folder, and nothing when the player closed the sheet", async () => {
    const { db } = await open(1);
    expect((await backUp(db as never, NOW, io({ hand: async () => "saved" })))?.text).toMatch(/^middle-earth-player-2026-11-23\.backup is saved\./);
    expect(await backUp(db as never, NOW, io({ hand: async () => "cancelled" }))).toBeNull();
  });

  it("reports a file that could not be written", async () => {
    const { db } = await open(1);
    const hand = async (): Promise<never> => {
      throw new Error("no space");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await backUp(db as never, NOW, io({ hand }))).toEqual({ text: "The backup could not be made.", failed: true });
    warn.mockRestore();
  });

  it("restores a backup made on another device and starts the app again", async () => {
    const source = await open(2);
    const from = io();
    await backUp(source.db as never, NOW, from);
    const target = await open(1);
    const phone = io({ pick: async () => from.handed[0]! });
    const picked = await pickBackup(phone);
    expect(picked && "bytes" in picked).toBe(true);
    const said = await restore(target.db as never, picked as Picked, phone);
    expect(said).toEqual({ text: "Restored. The app is starting again.", failed: false });
    expect(phone.reloads).toBe(1);
    expect(saveIds(target.client)).toEqual([source.saveId]);
  });

  it("refuses a file that is not a backup and leaves the games as they are", async () => {
    const target = await open(1);
    const notBackup = io({ pick: async () => ({ bytes: new TextEncoder().encode("a holiday photo"), name: "photo.jpg" }) });
    expect(await pickBackup(notBackup)).toEqual({ text: "That file is not a Middle-earth Player backup.", failed: true });
    expect(await pickBackup(io())).toBeNull();
    const unreadable = io({
      pick: async () => {
        throw new Error("gone");
      },
    });
    expect(await pickBackup(unreadable)).toEqual({ text: "That backup is damaged and cannot be read.", failed: true });
    // A SQLite header over rubbish passes the pick and is refused by the restore, which changes nothing and does not start the app again.
    const header = new TextEncoder().encode("SQLite format 3\u0000 and then nothing a database holds");
    const phone = io();
    const said = await restore(target.db as never, { bytes: header, name: "broken.backup" }, phone);
    expect(said.failed).toBe(true);
    expect(phone.reloads).toBe(0);
    expect(saveIds(target.client)).toEqual([target.saveId]);
  });
});

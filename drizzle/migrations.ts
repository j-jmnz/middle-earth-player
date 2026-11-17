import journal from "./meta/_journal.json";
import m0000 from "./0000_user.sql";
import m0001 from "./0001_booklets.sql";
import m0002 from "./0002_archived_saves.sql";
import m0003 from "./0003_save_updated_at.sql";
import m0004 from "./0004_standalone_games.sql";
import m0005 from "./0005_deck_updated_at.sql";
import m0006 from "./0006_table_settings.sql";
import m0007 from "./0007_runs.sql";
import m0008 from "./0008_run_active_ms.sql";
import m0009 from "./0009_deck_position.sql";
import m0010 from "./0010_checkpoint.sql";
import m0011 from "./0011_deck_side.sql";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
    m0006,
    m0007,
    m0008,
    m0009,
    m0010,
    m0011,
  },
};

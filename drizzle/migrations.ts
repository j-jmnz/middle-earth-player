import journal from "./meta/_journal.json";
import m0000 from "./0000_user.sql";
import m0001 from "./0001_booklets.sql";
import m0002 from "./0002_archived_saves.sql";
import m0003 from "./0003_standalone_games.sql";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
  },
};

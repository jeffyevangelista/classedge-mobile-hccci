// 1. Import the Drizzle wrapper and your schema
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import {
  PowerSyncDatabase,
  SyncClientImplementation,
} from "@powersync/react-native";
import { open } from "@op-engineering/op-sqlite";
import useStore from "@/lib/store";
import { AppSchema } from "./AppSchema"; // Your PowerSync Schema
import { Connector } from "./Connector";
import * as drizzleSchema from "./schema"; // Your Drizzle Table definitions
import {
  syncRoleStreams,
  unsubscribeAllRoleStreams,
} from "./streamSubscriptions";

// const logger = createBaseLogger();
// logger.useDefaults();
// logger.setLevel(__DEV__ ? LogLevel.DEBUG : LogLevel.WARN);

const opSqlite = new OPSqliteOpenFactory({
  dbFilename: "powersync.db",
});

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: opSqlite,
  // logger,
});

// 2. Create the Drizzle DB instance
// This 'db' object is what you will use for all your queries
export const db = wrapPowerSyncWithDrizzle(powersync, {
  schema: drizzleSchema,
});

export const logDbPath = () => {
  if (__DEV__) {
    const tempDb = open({ name: "powersync.db" });
    console.log("📂 DB Path:", tempDb.getDbPath());
    tempDb.close();
  }
};

export const setupPowerSync = async () => {
  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS attachments_local (
      id TEXT PRIMARY KEY,
      resource TEXT NOT NULL,
      source_table TEXT NOT NULL,
      source_col TEXT NOT NULL,
      priority INTEGER NOT NULL,
      state TEXT NOT NULL,
      local_uri TEXT,
      size_bytes INTEGER,
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_attachments_state_priority ON attachments_local (state, priority);`,
  );
  const connector = new Connector();
  // Explicit opt-in to the Rust sync client. RUST is the default in
  // @powersync/common 1.52.0, but pinning it here keeps the choice stable
  // if the upstream default flips back.
  powersync.connect(connector, {
    clientImplementation: SyncClientImplementation.RUST,
  });

  // Phase C: subscribe only to streams matching the user's role.
  // Safe before backend flips auto_subscribe:false — calling subscribe()
  // on a stream that is already auto-subscribed is a no-op.
  const { powersyncToken } = useStore.getState();
  await syncRoleStreams(powersyncToken);
};

export const resetPowerSync = async () => {
  const { clearAllAttachments } = await import(
    "@/features/attachments/attachments.api"
  );
  await clearAllAttachments();
  unsubscribeAllRoleStreams();
  await powersync.disconnectAndClear();
  await setupPowerSync();
};

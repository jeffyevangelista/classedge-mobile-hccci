// 1. Import the Drizzle wrapper and your schema
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import { PowerSyncDatabase } from "@powersync/react-native";
import { open } from "@op-engineering/op-sqlite";
import { AppSchema } from "./AppSchema"; // Your PowerSync Schema
import { Connector } from "./Connector";
import * as drizzleSchema from "./schema"; // Your Drizzle Table definitions

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
  powersync.connect(connector);
};

export const resetPowerSync = async () => {
  await powersync.disconnectAndClear();
  await setupPowerSync();
};

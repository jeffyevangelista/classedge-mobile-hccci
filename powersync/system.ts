// 1. Import the Drizzle wrapper and your schema
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import { PowerSyncDatabase } from "@powersync/react-native";
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

export const setupPowerSync = async () => {
  // Create local-only tables
  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS course_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      visited_at TEXT NOT NULL
    )
  `);

  const connector = new Connector();
  powersync.connect(connector);
};

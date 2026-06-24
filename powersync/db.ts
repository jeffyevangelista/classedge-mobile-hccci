import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import { PowerSyncDatabase } from "@powersync/react-native";
import { AppSchema } from "./AppSchema";
import * as drizzleSchema from "./schema";

const opSqlite = new OPSqliteOpenFactory({
  dbFilename: "powersync.db",
});

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: opSqlite,
});

export const db = wrapPowerSyncWithDrizzle(powersync, {
  schema: drizzleSchema,
});

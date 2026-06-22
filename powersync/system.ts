// 1. Import the Drizzle wrapper and your schema

import { open } from "@op-engineering/op-sqlite";
import { wrapPowerSyncWithDrizzle } from "@powersync/drizzle-driver";
import { OPSqliteOpenFactory } from "@powersync/op-sqlite";
import {
  PowerSyncDatabase,
  SyncClientImplementation,
} from "@powersync/react-native";
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

/**
 * Initialize PowerSync after login. Takes the `powersyncToken` explicitly
 * (rather than reading from `useStore.getState()`) so callers commit to the
 * exact token they expect — closes a race where the provider could call this
 * with the store mid-write and `syncRoleStreams` would see an empty token,
 * silently subscribing to zero role-specific streams.
 */
export const setupPowerSync = async (
  powersyncToken: string | null | undefined,
) => {
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

  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS sync_events_local (
      id          TEXT PRIMARY KEY,
      ts          TEXT NOT NULL,
      kind        TEXT NOT NULL,
      target      TEXT,
      status      TEXT NOT NULL,
      http_status INTEGER,
      message     TEXT,
      duration_ms INTEGER,
      retry_count INTEGER
    );
  `);
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_sync_events_ts ON sync_events_local (ts DESC);`,
  );

  await powersync.execute(`
    CREATE TABLE IF NOT EXISTS ps_crud_meta_local (
      op_id            TEXT PRIMARY KEY,
      attempt_count    INTEGER NOT NULL DEFAULT 0,
      first_failed_at  TEXT,
      last_attempt_at  TEXT NOT NULL,
      last_error       TEXT,
      last_http_status INTEGER
    );
  `);
  await powersync.execute(
    `CREATE INDEX IF NOT EXISTS idx_ps_crud_meta_stuck ON ps_crud_meta_local (attempt_count, first_failed_at);`,
  );

  // Phase D (permanent 4xx retry handling): add two columns to track dropped
  // ops. ALTER TABLE … ADD COLUMN is idempotent at the SQL level only on
  // first install; on re-install SQLite errors with "duplicate column name",
  // which we swallow. Any other error is rethrown.
  const tryAddColumn = async (column: string) => {
    try {
      await powersync.execute(
        `ALTER TABLE ps_crud_meta_local ADD COLUMN ${column} TEXT;`,
      );
    } catch (err) {
      if (!String(err).toLowerCase().includes("duplicate column")) throw err;
    }
  };
  await tryAddColumn("dropped_at");
  await tryAddColumn("target");

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
  await syncRoleStreams(powersyncToken);
};

export const resetPowerSync = async () => {
  const { clearAllAttachments } = await import(
    "@/features/attachments/attachments.api"
  );
  await clearAllAttachments();
  unsubscribeAllRoleStreams();
  await powersync.disconnectAndClear();
  const { powersyncToken } = useStore.getState();
  await setupPowerSync(powersyncToken);
};

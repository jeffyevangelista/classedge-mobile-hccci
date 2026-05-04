import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const attachmentsLocalTable = sqliteTable("attachments_local", {
  id: text("id").primaryKey(),
  resource: text("resource").notNull(),
  sourceTable: text("source_table").notNull(),
  sourceCol: text("source_col").notNull(),
  priority: integer("priority").notNull(),
  state: text("state").notNull(),
  localUri: text("local_uri"),
  sizeBytes: integer("size_bytes"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export type AttachmentState = "queued" | "downloading" | "synced" | "failed";

export const ATTACHMENT_STATES = {
  QUEUED: "queued",
  DOWNLOADING: "downloading",
  SYNCED: "synced",
  FAILED: "failed",
} as const;

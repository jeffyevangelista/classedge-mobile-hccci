import { createId } from "@paralleldrive/cuid2";
import { type InferInsertModel, type InferSelectModel, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const utcNow = sql`(STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'))`;

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey().$defaultFn(createId), // PowerSync expects a text 'id' (UUID)
  name: text("name").notNull(),
  teacherName: text("teacher_name").notNull(),
  roomNumber: text("room_number").notNull(),

  createdAt: text("created_at").notNull().default(utcNow),
  updatedAt: text("updated_at").notNull().default(utcNow),

  clientCreatedAt: text("client_created_at").notNull().default(utcNow),
  clientUpdatedAt: text("client_updated_at")
    .notNull()
    .default(utcNow)
    .$onUpdateFn(() => new Date().toISOString()),
  ownerId: text("owner_id").notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey(),
  authorId: text("author_id").notNull(),
  eventId: text("event_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
});

export const drizzleSchema = { subjects, announcements };

export type Subject = InferSelectModel<typeof subjects>;
export type NewSubject = InferInsertModel<typeof subjects>;

import { DrizzleAppSchema } from "@powersync/drizzle-driver";
import { drizzleSchema } from "./schema";

export const AppSchema = new DrizzleAppSchema(drizzleSchema);

export type Database = (typeof AppSchema)["types"];

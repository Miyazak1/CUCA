import { integer, pgTable } from "drizzle-orm/pg-core";
export * from "../../../../src/server/db/schema.ts";

export const rehearsalMarker = pgTable("__cuac_rehearsal_marker", {
  id: integer("id").primaryKey(),
});

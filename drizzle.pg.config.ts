import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/pg",
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
});

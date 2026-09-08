import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./apps/api/drizzle",
  schema: "./apps/api/db/schema.ts",
  dialect: "sqlite",
});

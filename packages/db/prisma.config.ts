import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// The .env lives at the repo root; Prisma runs from packages/db, so load it explicitly.
loadEnv({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
});

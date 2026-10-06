import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection on Neon; locally both
    // URLs point at the same Docker database.
    url: env("DIRECT_URL"),
  },
})

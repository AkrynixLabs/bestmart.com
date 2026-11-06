import "dotenv/config"
import { defineConfig } from "prisma/config"

// Migrations need a direct (unpooled) connection on Neon; locally both URLs
// point at the same Docker database. `prisma generate` (run on every
// install, including Vercel and CI before any env is set) needs no database,
// so the datasource is only configured when a URL is available; commands
// that do need it (migrate, studio) fail with a clear Prisma error instead.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(url ? { datasource: { url } } : {}),
})

import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

// Readiness: config parses and the database answers. Returns 503 otherwise,
// without leaking the underlying error to the caller.
export const dynamic = "force-dynamic"

export async function GET() {
  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json(
      { status: "ok", checks: { database: "ok" }, latencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    logger.error("readiness check failed", { error })
    return Response.json(
      { status: "unavailable", checks: { database: "error" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}

// Liveness: the function is up. No dependencies, so it answers even when the
// database or env config is broken (use /api/health/ready for those).
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(
    { status: "ok", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  )
}

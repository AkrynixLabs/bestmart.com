import { ADMIN_ROLES, getCurrentUser } from "@/lib/auth/session"
import { audit } from "@/lib/audit"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { getPrivate } from "@/lib/storage"

// Streams a seller's Ghana Card to an admin. Never cached, never sniffed, and
// sandboxed so a hostile PDF can't run script in our origin. Every view is
// audit-logged (it's personal data).
export async function GET(_req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser()
  if (!user || !ADMIN_ROLES.includes(user.role)) return new Response("Not found", { status: 404 })

  const { applicationId } = await params
  const app = await prisma.sellerApplication.findUnique({ where: { id: applicationId }, select: { ghanaCardImageKey: true } })
  if (!app) return new Response("Not found", { status: 404 })

  const file = await getPrivate(app.ghanaCardImageKey)
  if (!file) return new Response("Not found", { status: 404 })

  await audit({ actorId: user.id, action: "seller_application.kyc_viewed", entityType: "seller_application", entityId: applicationId, ip: await clientIp() })

  return new Response(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  })
}

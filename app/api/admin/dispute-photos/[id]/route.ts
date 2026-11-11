import { audit } from "@/lib/audit"
import { ADMIN_ROLES, getCurrentUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { clientIp } from "@/lib/request"
import { getPrivate } from "@/lib/storage"

// Streams a dispute evidence photo to an admin: private, never cached,
// sandboxed, and every view is audit-logged.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !ADMIN_ROLES.includes(user.role)) return new Response("Not found", { status: 404 })
  const { id } = await params
  const photo = await prisma.disputeAttachment.findUnique({ where: { id }, select: { key: true, disputeId: true } })
  if (!photo) return new Response("Not found", { status: 404 })
  const file = await getPrivate(photo.key)
  if (!file) return new Response("Not found", { status: 404 })
  await audit({ actorId: user.id, action: "dispute.photo_viewed", entityType: "dispute", entityId: photo.disputeId, metadata: { attachmentId: id }, ip: await clientIp() })
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

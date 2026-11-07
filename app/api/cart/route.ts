import { currentCartId } from "@/lib/cart/cart"
import { prisma } from "@/lib/prisma"

// Item count for the header badge. Never cached: it's per visitor.
export async function GET() {
  const cartId = await currentCartId()
  const count = cartId ? ((await prisma.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } }))._sum.quantity ?? 0) : 0
  return Response.json({ count }, { headers: { "Cache-Control": "private, no-store" } })
}

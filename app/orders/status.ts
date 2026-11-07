import type { OrderStatus } from "@/lib/generated/prisma/client"

export const orderStatusLabel: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  expired: "Expired (not paid in time)",
}

import type { Role } from "@/lib/generated/prisma/client"

export const roleLabel: Record<Role, string> = { customer: "Customer", seller: "Seller", ops_admin: "Ops admin", super_admin: "Super admin" }

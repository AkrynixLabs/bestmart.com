// Promote (or demote) an existing account. Use it once to create the first
// Super Admin, since no one can grant admin rights through the UI yet.
//
//   npx tsx scripts/set-role.ts you@example.com super_admin
//
// Roles: customer | ops_admin | super_admin. ("seller" is granted only by
// approving a seller application, so it gets a store.)
import "dotenv/config" // loads .env when present; CI passes env vars directly
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient, type Role } from "../lib/generated/prisma/client"

const ALLOWED: Role[] = ["customer", "ops_admin", "super_admin"]

async function main() {
  const [emailArg, roleArg] = process.argv.slice(2)
  if (!emailArg || !roleArg || !ALLOWED.includes(roleArg as Role)) {
    console.error(`Usage: scripts/set-role.ts <email> <${ALLOWED.join("|")}>`)
    process.exit(1)
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
  try {
    const email = emailArg.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new Error(`No account with email ${email}. Sign up first.`)
    if (user.role === "seller") throw new Error("This account is a seller; use a separate account for admin work.")
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: roleArg as Role, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } }),
      prisma.auditLog.create({ data: { actorId: null, action: "user.role_set_by_script", entityType: "user", entityId: user.id, metadata: { from: user.role, to: roleArg } } }),
    ])
    console.log(`${email}: ${user.role} -> ${roleArg}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

import "server-only"
import bcrypt from "bcryptjs"

const COST = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// Compared against when no account exists, so a failed login takes the same
// time either way (prevents timing-based account discovery). Generated once
// per process, with the same cost as real hashes.
let dummyHash: Promise<string> | undefined

export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash("bestmart-timing-equaliser", COST)
  await bcrypt.compare(plain, await dummyHash)
}

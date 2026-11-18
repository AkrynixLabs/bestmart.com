import "server-only"
import { hash, verify } from "@node-rs/bcrypt"

// Native bcrypt (Rust, via N-API): hashing runs on a libuv worker thread, so
// a sign-in doesn't block every other request the way pure-JS bcrypt does.
// Same hash format as bcryptjs ($2a$/$2b$), so existing hashes still verify.
const COST = 12

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, COST)
}

export function verifyPassword(plain: string, stored: string): Promise<boolean> {
  return verify(plain, stored)
}

// Compared against when no account exists, so a failed login takes the same
// time either way (prevents timing-based account discovery). Generated once
// per process, with the same cost as real hashes.
let dummyHash: Promise<string> | undefined

export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hash("bestmart-timing-equaliser", COST)
  await verify(plain, await dummyHash)
}

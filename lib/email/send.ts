import "server-only"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Resend } from "resend"

import { allowDevFallbacks, env, isE2ETestMode } from "@/lib/env"
import { logger } from "@/lib/logger"

export type Email = { to: string; subject: string; html: string; text: string }

// Without RESEND_API_KEY outside production (or in E2E test mode), emails are written to
// .data/outbox/ (git-ignored) and their text logged, so links can be opened
// locally and end-to-end tests can read them. Production requires Resend.
export const OUTBOX_DIR = path.join(process.cwd(), ".data", "outbox")

let client: Resend | undefined

export async function sendEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM } = env()
  // Test mode always uses the outbox, even if a real key is configured.
  if (isE2ETestMode() || !RESEND_API_KEY) {
    if (!allowDevFallbacks()) throw new Error("RESEND_API_KEY is required in production")
    await mkdir(OUTBOX_DIR, { recursive: true })
    const file = path.join(OUTBOX_DIR, `${Date.now()}-${email.to.replace(/[^a-z0-9@.]/gi, "_")}.json`)
    await writeFile(file, JSON.stringify({ from: EMAIL_FROM, ...email }, null, 2))
    logger.info("email written to local outbox", { to: email.to, subject: email.subject, file })
    return
  }
  client ??= new Resend(RESEND_API_KEY)
  const { error } = await client.emails.send({ from: EMAIL_FROM, ...email })
  if (error) throw new Error(`Resend rejected the email: ${error.message}`)
}

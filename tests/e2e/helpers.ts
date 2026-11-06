import { execFileSync } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { expect, type Page } from "@playwright/test"

const OUTBOX = path.join(process.cwd(), ".data", "outbox")

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
}

/** Waits for the newest email to `to` in the local outbox and returns the first link to `pathPrefix`. */
export async function linkFromEmail(to: string, pathPrefix: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  const safe = to.replace(/[^a-z0-9@.]/gi, "_")
  while (Date.now() < deadline) {
    const files = (await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith(`-${safe}.json`)).sort()
    for (const file of files.reverse()) {
      const email = JSON.parse(await readFile(path.join(OUTBOX, file), "utf8")) as { text: string }
      const match = email.text.match(new RegExp(`https?://[^\\s]+${pathPrefix.replace(/[/?]/g, "\\$&")}[^\\s]*`))
      if (match) return new URL(match[0]).pathname + new URL(match[0]).search
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`No email to ${to} containing ${pathPrefix}`)
}

export async function signUpAndVerify(page: Page, opts: { name: string; email: string; password: string }) {
  await page.goto("/signup")
  await page.getByLabel("Full name").fill(opts.name)
  await page.getByLabel("Email").fill(opts.email)
  await page.getByLabel("Password", { exact: true }).fill(opts.password)
  await page.getByLabel("Confirm password").fill(opts.password)
  await page.getByLabel(/I agree to the/).check()
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/verify-email\/sent/)

  await page.goto(await linkFromEmail(opts.email, "/verify-email?token="))
  await page.getByRole("button", { name: "Confirm my email" }).click()
  await expect(page).toHaveURL(/\/login\?verified=1/)
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/account$/)
}

export async function logOut(page: Page) {
  await page.context().clearCookies()
}

export function setRole(email: string, role: "customer" | "ops_admin" | "super_admin") {
  execFileSync("npx", ["tsx", "scripts/set-role.ts", email, role], { stdio: "pipe" })
}

/** A form message with the given role, excluding Next.js's hidden route announcer (also role="alert"). */
export function formMessage(page: Page, role: "alert" | "status" = "alert") {
  return page.getByRole(role).and(page.locator(":not(#__next-route-announcer__)"))
}

export const PASSWORD = "Accra2026pass"

/** Signs up `seller`, applies to sell, and has `admin` (created if needed) approve it. Ends signed out. */
export async function createApprovedSeller(page: Page, seller: { name: string; email: string }, admin: { name: string; email: string }, storeName: string) {
  await signUpAndVerify(page, { ...seller, password: PASSWORD })
  await logIn(page, seller.email, PASSWORD)
  await page.goto("/sell/apply")
  await page.getByLabel("Store name").fill(storeName)
  await page.getByLabel("Business phone").fill("0241234567")
  await page.getByLabel("Region").selectOption("greater_accra")
  await page.getByLabel("Town or city").fill("Accra")
  await page.getByLabel("Ghana Card number").fill("GHA-123456789-0")
  await page.getByLabel(/Photo or scan of your Ghana Card/).setInputFiles("tests/e2e/fixtures/ghana-card.png")
  await page.getByLabel("Network").selectOption("MTN")
  await page.getByLabel("MoMo number").fill("0241234567")
  await page.getByLabel(/I confirm these details/).check()
  await page.getByRole("button", { name: "Submit application" }).click()
  await expect(page.getByText("Your application is under review")).toBeVisible()
  await logOut(page)

  await signUpAndVerify(page, { ...admin, password: PASSWORD })
  setRole(admin.email, "super_admin")
  await logIn(page, admin.email, PASSWORD)
  await page.goto("/admin/seller-applications")
  await page.getByRole("link", { name: storeName }).click()
  await page.getByRole("button", { name: "Approve and create store" }).click()
  await expect(page.getByText("Application approved")).toBeVisible()
  await logOut(page)
}

/** A status message containing `text` (pages can show several status banners at once). */
export function statusWith(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text })
}

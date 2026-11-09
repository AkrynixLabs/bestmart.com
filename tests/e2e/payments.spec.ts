import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

import { FAKE_SECRET } from "../../lib/payments/fake-secret"
import { signBody } from "../../lib/payments/signature"
import { createApprovedSeller, createPublishedProduct, expireOrder, linkFromEmail, logIn, logOut, PASSWORD, resetDeliverySettings, signUpAndVerify, statusWith, uniqueEmail } from "./helpers"

// Paying through the local Paystack stand-in (same signed webhook and
// verification path as real Paystack), the seller ledger, webhook replay,
// admin refunds, and payments that arrive after the stock hold ended.

const FAKE = path.join(process.cwd(), ".data", "fake-payments")

async function fakeTransaction(orderNumber: string) {
  const files = (await readdir(FAKE)).filter((f) => f.startsWith(orderNumber)).sort()
  return JSON.parse(await readFile(path.join(FAKE, files.at(-1)!), "utf8")) as { id: number; reference: string; amount: number }
}

test.describe("payments journey", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only")
  // Journey steps create accounts, stores and products; allow for a busy parallel run.
  test.describe.configure({ mode: "serial", timeout: 90_000 })
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  test.beforeAll(() => resetDeliverySettings())

  const run = Date.now().toString(36)
  const seller = { name: "Kwame Crafts", email: uniqueEmail("kwame") }
  const admin = { name: "Money Admin", email: uniqueEmail("moneyadmin") }
  const shopper = { name: "Efua Buyer", email: uniqueEmail("efua") }
  const title = `Shea soap ${run}`
  let productPath = ""
  let firstOrder = ""

  async function placeOrder(page: Page, quantity: string) {
    await page.goto(productPath)
    await page.getByLabel("Quantity").selectOption(quantity)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to your cart.")).toBeVisible()
    await page.goto("/checkout")
    await page.getByRole("button", { name: /Place order/ }).click()
    await expect(page).toHaveURL(/\/orders\/BM-\d{6}-[0-9A-Z]{5}\?placed=1/)
    return new URL(page.url()).pathname.split("/").pop()!
  }

  test("setup: seller with a product (stock 5), shopper with an address", async ({ page }) => {
    await createApprovedSeller(page, seller, admin, `Kwame Crafts ${run}`)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/settings")
    await page.getByLabel("Area or suburb").fill("Madina")
    await page.getByRole("button", { name: "Save pickup location" }).click()
    await expect(statusWith(page, "Pickup location saved.")).toBeVisible()
    productPath = await createPublishedProduct(page, { title, category: "Beauty", price: "45", stock: "5" })
    await logOut(page)

    await signUpAndVerify(page, { ...shopper, password: PASSWORD })
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/account/addresses/new")
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("Kokomlemle")
    await page.getByLabel("Phone number").fill("0201234567")
    await page.getByRole("button", { name: "Use my location" }).click()
    await expect(page.getByText(/Pin set at/)).toBeVisible()
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/account\/addresses\?saved=1/)
  })

  test("a declined payment changes nothing; an approved one marks the order paid", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    firstOrder = await placeOrder(page, "2")

    await page.getByRole("button", { name: "Pay GH₵120.00" }).click()
    await expect(page.getByRole("heading", { name: "Pay GH₵120.00" })).toBeVisible()
    await page.getByRole("button", { name: "Decline" }).click()
    await expect(page.getByText("The payment didn't go through.")).toBeVisible()

    await page.getByRole("button", { name: "Pay GH₵120.00" }).click()
    await page.getByRole("button", { name: "Approve test Mobile Money payment" }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${firstOrder}\\?payment=paid`))
    await expect(statusWith(page, "Payment received.")).toBeVisible()
    await expect(page.getByText("Paid", { exact: true })).toBeVisible()
    await linkFromEmail(shopper.email, `/orders/${firstOrder}`)
    await linkFromEmail(seller.email, "/seller")
  })

  test("the seller's earnings show the sale, minus commission, plus delivery, as pending", async ({ page }) => {
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/earnings")
    // 2 × 45 = 90, minus 10% commission (9), plus 30 delivery = 111.
    await expect(page.getByText("Pending").locator("..").getByText("GH₵111.00")).toBeVisible()
    await expect(page.getByText("BestMart commission")).toBeVisible()
  })

  test("a replayed webhook is ignored and a forged one is rejected", async ({ request, page }) => {
    const tx = await fakeTransaction(firstOrder)
    const body = JSON.stringify({ event: "charge.success", data: { id: tx.id, reference: tx.reference, amount: tx.amount, currency: "GHS", status: "success" } })
    const replay = await request.post("/api/webhooks/paystack", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": signBody(body, FAKE_SECRET) } })
    expect(replay.status()).toBe(200)
    expect(await replay.json()).toEqual({ duplicate: true })
    const forged = await request.post("/api/webhooks/paystack", { data: body, headers: { "content-type": "application/json", "x-paystack-signature": signBody(body, "wrong-secret") } })
    expect(forged.status()).toBe(401)

    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/earnings")
    await expect(page.getByText("Pending").locator("..").getByText("GH₵111.00")).toBeVisible() // unchanged
  })

  test("an admin refunds one item: the buyer is told and commission comes back to the seller", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto(`/admin/orders/${firstOrder}`)
    await page.getByLabel("Amount (GH₵)").fill("45")
    await page.getByLabel("Reason (sent to the buyer)").fill("One bar arrived broken")
    await page.getByRole("button", { name: "Refund" }).click()
    await expect(statusWith(page, "Refund sent.")).toBeVisible()
    await expect(page.getByText("Commission returned (pending)")).toBeVisible()
    await linkFromEmail(shopper.email, `/orders/${firstOrder}`)
    // Over-refunding is refused (75 left: 45 items + 30 delivery).
    await page.getByLabel("Amount (GH₵)").fill("80")
    await page.getByLabel("Reason (sent to the buyer)").fill("Too much")
    await page.getByRole("button", { name: "Refund" }).click()
    await expect(page.getByText(/can still be refunded/)).toBeVisible()

    await logOut(page)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/earnings")
    // 111 - 45 + 4.50 = 70.50
    await expect(page.getByText("Pending").locator("..").getByText("GH₵70.50")).toBeVisible()
    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(`/orders/${firstOrder}`)
    await expect(page.getByText("−GH₵45.00")).toBeVisible()
  })

  test("paying after the hold expired re-reserves the stock if it's still there", async ({ page, request }) => {
    await logIn(page, shopper.email, PASSWORD)
    const order = await placeOrder(page, "1") // stock 3 -> 2
    await page.getByRole("button", { name: /^Pay / }).click()
    await expect(page.getByRole("button", { name: "Approve test Mobile Money payment" })).toBeVisible()
    const payPage = page.url()

    expireOrder(order)
    await request.get("/api/cron/release-reservations") // stock back to 3
    await page.goto(payPage)
    await page.getByRole("button", { name: "Approve test Mobile Money payment" }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${order}\\?payment=paid`))
    await expect(page.getByText("Paid", { exact: true })).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("Only 2 left")).toBeVisible()
  })

  test("paying after the hold expired and the stock is gone refunds in full", async ({ page, request }) => {
    await logIn(page, shopper.email, PASSWORD)
    const order = await placeOrder(page, "1") // stock 2 -> 1
    await page.getByRole("button", { name: /^Pay / }).click()
    await expect(page.getByRole("button", { name: "Approve test Mobile Money payment" })).toBeVisible()
    const payPage = page.url()
    expireOrder(order)
    await request.get("/api/cron/release-reservations") // stock back to 2

    // Meanwhile the seller sells out elsewhere.
    await logOut(page)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/products")
    await page.getByRole("link", { name: new RegExp(title) }).click()
    await page.getByLabel("Stock for Default", { exact: true }).fill("0")
    await page.getByRole("button", { name: "Save prices and stock" }).click()
    await expect(statusWith(page, "Variants saved.")).toBeVisible()

    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(payPage)
    await page.getByRole("button", { name: "Approve test Mobile Money payment" }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${order}\\?payment=refunded`))
    await expect(page.getByText("we've refunded it in full")).toBeVisible()
    await expect(page.getByText("Refunded", { exact: true })).toBeVisible()
  })
})

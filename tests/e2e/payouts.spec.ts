import { expect, test, type Page } from "@playwright/test"

import {
  buyAndPay,
  createApprovedSeller,
  createPublishedProduct,
  linkFromEmail,
  logIn,
  logOut,
  PASSWORD,
  resetDeliverySettings,
  runDailyJobs,
  signUpAndVerify,
  statusWith,
  timeTravel,
  uniqueEmail,
  type PayoutDetails,
} from "./helpers"

// Weekly payouts (runs in its own Playwright project, after every other
// test, because a batch pays every eligible seller in the database).
// Three sellers earn GH₵70.50 each: one is paid by MoMo, one has an account
// the stand-in rejects (ending 999) so the money comes back, and one typed a
// bank Paystack doesn't recognise until the admin picks it.

test.describe("payouts", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 })
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  test.beforeAll(() => resetDeliverySettings())

  const run = Date.now().toString(36)
  const admin = { name: "Payout Admin", email: uniqueEmail("payoutadmin") }
  const shopper = { name: "Payout Shopper", email: uniqueEmail("payshop") }
  const sellers = [
    { key: "ok", name: "Paid Seller", email: uniqueEmail("paidseller"), store: `MoMo Store ${run}`, payout: { method: "momo", network: "MTN", number: "0241234567" } as PayoutDetails },
    { key: "fail", name: "Failing Seller", email: uniqueEmail("failseller"), store: `Closed Account ${run}`, payout: { method: "momo", network: "Telecel", number: "0201234999" } as PayoutDetails },
    { key: "bank", name: "Bank Seller", email: uniqueEmail("bankseller"), store: `Bank Store ${run}`, payout: { method: "bank", bank: "Sunshine Savings", number: "1234567890123" } as PayoutDetails },
  ]

  async function earn(page: Page, seller: (typeof sellers)[number], first: boolean) {
    // A seller with one delivered order whose hold has passed: GH₵70.50 available (45 - 4.50 + 30).
    await createApprovedSeller(page, seller, first ? admin : { name: "Helper Admin", email: uniqueEmail("helperadmin") }, seller.store, seller.payout)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/settings")
    await page.getByLabel("Area or suburb").fill("Madina")
    await page.getByRole("button", { name: "Save pickup location" }).click()
    await expect(statusWith(page, "Pickup location saved.")).toBeVisible()
    const productPath = await createPublishedProduct(page, { title: `Payout item ${seller.key} ${run}`, category: "Beauty", price: "45", stock: "5" })
    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    const number = await buyAndPay(page, productPath)
    await logOut(page)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/orders")
    await page.getByRole("link", { name: new RegExp(number) }).click()
    await page.getByLabel("Rider's name").fill("Kojo")
    await page.getByLabel("Rider's phone").fill("024 111 2222")
    await page.getByRole("button", { name: "Mark as shipped" }).click()
    await expect(statusWith(page, "Marked as shipped.")).toBeVisible()
    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(`/orders/${number}`)
    await page.getByRole("button", { name: "I received it" }).click()
    await expect(statusWith(page, "Thanks for confirming!")).toBeVisible()
    timeTravel(number, "deliveredAt", 4)
    await runDailyJobs(page)
    await logOut(page)
  }

  test("setup: a shopper with an address", async ({ page }) => {
    await signUpAndVerify(page, { ...shopper, password: PASSWORD })
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/account/addresses/new")
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("Kokomlemle")
    await page.getByLabel("Phone number").fill("0201234567")
    await page.getByRole("button", { name: "Use my location" }).click()
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/account\/addresses\?saved=1/)
  })

  for (const [i, seller] of sellers.entries()) {
    test(`setup: ${seller.name} earns GH₵70.50`, async ({ page }) => {
      await earn(page, seller, i === 0)
      await logIn(page, seller.email, PASSWORD)
      await page.goto("/seller/earnings")
      await expect(page.getByText("Available for payout").locator("..").getByText("GH₵70.50")).toBeVisible()
    })
  }

  test("only the Super Admin can open payouts", async ({ page }) => {
    await logIn(page, sellers[0]!.email, PASSWORD)
    expect((await page.goto("/admin/payouts"))?.status()).toBe(404)
  })

  test("the Super Admin prepares a batch, fixes an unknown bank and approves; results reach the sellers", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/payouts")
    // Clear any draft left by an earlier, interrupted run.
    if (await page.getByRole("button", { name: "Cancel this draft" }).isVisible()) {
      await page.getByRole("button", { name: "Cancel this draft" }).click()
      await expect(statusWith(page, "Draft cancelled.")).toBeVisible()
    }
    await page.getByRole("button", { name: "Prepare a batch now" }).click()
    await expect(statusWith(page, "Batch prepared.")).toBeVisible()

    const batch = page.getByRole("region", { name: "Current batch" })
    const row = (store: string) => batch.getByRole("listitem").filter({ hasText: store })
    for (const s of sellers) await expect(row(s.store)).toContainText("GH₵70.50")
    await expect(row(sellers[2]!.store)).toContainText('Bank "Sunshine Savings" not recognised')
    await row(sellers[2]!.store).getByLabel("Bank").selectOption({ label: "GCB Bank Limited" })
    await row(sellers[2]!.store).getByRole("button", { name: "Save bank" }).click()
    await expect(row(sellers[2]!.store)).not.toContainText("not recognised")

    await page.getByRole("button", { name: "Approve and send" }).click()
    await expect(page.getByText("Tick the box to confirm")).toBeVisible()
    await page.getByLabel(/I've checked these payouts/).check()
    await page.getByRole("button", { name: "Approve and send" }).click()
    await expect(statusWith(page, "Approved.")).toBeVisible()

    // The batch is finished (the stand-in confirms transfers immediately) and in the history.
    const past = page.getByRole("listitem").filter({ hasText: sellers[0]!.store }).first()
    await expect(past).toContainText("paid")
    await expect(page.getByRole("listitem").filter({ hasText: sellers[1]!.store }).first()).toContainText("failed")
    await expect(page.getByRole("listitem").filter({ hasText: sellers[2]!.store }).first()).toContainText("paid")

    await linkFromEmail(sellers[0]!.email, "/seller/earnings")
    await linkFromEmail(sellers[1]!.email, "/seller/earnings")

    await logOut(page)
    await logIn(page, sellers[0]!.email, PASSWORD)
    await page.goto("/seller/earnings")
    await expect(page.getByText("Available for payout").locator("..").getByText("GH₵0.00")).toBeVisible()
    await expect(page.getByText("Sent to MTN")).toBeVisible()

    await logOut(page)
    await logIn(page, sellers[1]!.email, PASSWORD)
    await page.goto("/seller/earnings")
    await expect(page.getByText("Available for payout").locator("..").getByText("GH₵70.50")).toBeVisible() // returned
    await expect(page.getByText("Failed (returned to your balance)")).toBeVisible()
  })
})

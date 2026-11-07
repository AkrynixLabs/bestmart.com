import { expect, test } from "@playwright/test"

import { createApprovedSeller, createPublishedProduct, expireOrder, logIn, logOut, PASSWORD, resetDeliverySettings, setRole, signUpAndVerify, statusWith, uniqueEmail } from "./helpers"

// Cart → sign-up → address with a map pin → distance-based delivery →
// order with reserved stock → cancel and expiry give the stock back →
// delivery bands edited by the Super Admin apply to the next checkout.

test.describe("checkout journey", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only")
  test.describe.configure({ mode: "serial" })
  // "Use my location" in the address form resolves to central Accra.
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  // Fees below assume the default bands; restore them even if a run dies midway.
  test.beforeAll(() => resetDeliverySettings())
  test.afterAll(() => resetDeliverySettings())

  const run = Date.now().toString(36)
  const seller = { name: "Abena Shea", email: uniqueEmail("abena") }
  const admin = { name: "Delivery Admin", email: uniqueEmail("deladmin") }
  const shopper = { name: "Yaw Buyer", email: uniqueEmail("yaw") }
  const title = `Shea body cream ${run}`
  let productPath = ""
  let orderNumber = ""

  test("setup: a seller with a pickup area and a live product (stock 3)", async ({ page }) => {
    await createApprovedSeller(page, seller, admin, `Abena Naturals ${run}`)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/settings")
    await page.getByLabel("Area or suburb").fill("Madina")
    await page.getByRole("button", { name: "Save pickup location" }).click()
    await expect(statusWith(page, "Pickup location saved.")).toBeVisible()
    productPath = await createPublishedProduct(page, { title, category: "Beauty", price: "45", stock: "3" })
    // Sellers can't buy their own products.
    await page.goto(productPath)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("This is your own product.")).toBeVisible()
  })

  test("a guest fills a cart, signs up at checkout and the cart comes along", async ({ page }) => {
    await page.goto(productPath)
    await page.getByLabel("Quantity").selectOption("2")
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to your cart.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Cart, 2 items" })).toBeVisible()
    // Asking for more than the stock is refused.
    await page.getByLabel("Quantity").selectOption("2")
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Only 3 left (you have 2 in your cart).")).toBeVisible()

    await page.goto("/cart")
    await expect(page.getByRole("link", { name: title })).toBeVisible()
    await page.getByRole("link", { name: "Check out" }).click()
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fcheckout/)

    // Sign up in the same browser (the guest cart cookie stays), then sign in.
    await signUpAndVerify(page, { ...shopper, password: PASSWORD })
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/checkout")
    await expect(page.getByText(`2 × ${title}`)).toBeVisible()
    await expect(page.getByText("Add a delivery address to continue.")).toBeVisible()
  })

  test("an address with a map pin gives a distance-based fee, and the order reserves stock", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/checkout")
    await page.getByRole("link", { name: "Add address" }).click()
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("Kokomlemle")
    await page.getByLabel("Phone number").fill("0201234567")
    await page.getByRole("button", { name: "Use my location" }).click()
    await expect(page.getByText(/Pin set at 5\.60370, -0\.18700/)).toBeVisible()
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/checkout$/)

    // Pickup area Madina (no pin) to the buyer's pin: about 11 km by road, 10-20 km band.
    await expect(page.getByText("about 11 km, estimated between neighbourhoods")).toBeVisible()
    await expect(page.getByRole("button", { name: "Place order · GH₵120.00" })).toBeVisible() // 2 × 45 + 30
    await page.getByRole("button", { name: /Place order/ }).click()
    await expect(page).toHaveURL(/\/orders\/BM-\d{6}-[0-9A-Z]{5}\?placed=1/)
    orderNumber = new URL(page.url()).pathname.split("/").pop()!
    await expect(statusWith(page, "Order placed.")).toBeVisible()
    await expect(page.getByRole("timer")).toBeVisible()
    await expect(page.getByRole("link", { name: "Cart" })).toBeVisible() // cart emptied (no count)

    await page.goto(productPath)
    await expect(page.getByText("Only 1 left")).toBeVisible()
  })

  test("cancelling gives the stock back", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(`/orders/${orderNumber}`)
    await page.getByRole("button", { name: "Cancel order" }).click()
    await expect(statusWith(page, "Order cancelled.")).toBeVisible()
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("Only 3 left")).toBeVisible()
  })

  test("an unpaid order expires and the stock comes back", async ({ page, request }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(productPath)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to your cart.")).toBeVisible()
    await page.goto("/checkout")
    await page.getByRole("button", { name: /Place order/ }).click()
    await expect(page).toHaveURL(/\/orders\/BM-/)
    const number = new URL(page.url()).pathname.split("/").pop()!
    await page.goto(productPath)
    await expect(page.getByText("Only 2 left")).toBeVisible()

    expireOrder(number)
    const res = await request.get("/api/cron/release-reservations")
    expect(res.ok()).toBe(true)
    expect((await res.json()).released).toBeGreaterThanOrEqual(1)
    await page.goto(`/orders/${number}`)
    await expect(page.getByText("Expired (not paid in time)")).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("Only 3 left")).toBeVisible()
  })

  test("the Super Admin changes a delivery band and the next checkout uses it", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/settings")
    await page.getByLabel("Band 3 fee in cedis").fill("35")
    await page.getByRole("button", { name: "Save delivery fees" }).click()
    await expect(statusWith(page, "Delivery fees saved.")).toBeVisible()

    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(productPath)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to your cart.")).toBeVisible()
    await page.goto("/checkout")
    await expect(page.getByRole("button", { name: "Place order · GH₵80.00" })).toBeVisible() // 45 + 35
  })

  test("other people's orders are invisible, and ops admins can't edit fees", async ({ page }) => {
    await logIn(page, seller.email, PASSWORD)
    expect((await page.goto(`/orders/${orderNumber}`))?.status()).toBe(404)
    await logOut(page)
    const ops = { name: "Ops Person", email: uniqueEmail("ops") }
    await signUpAndVerify(page, { ...ops, password: PASSWORD })
    setRole(ops.email, "ops_admin")
    await logIn(page, ops.email, PASSWORD)
    expect((await page.goto("/admin/settings"))?.status()).toBe(404)
  })
})

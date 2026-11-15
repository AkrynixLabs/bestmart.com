import { expect, test } from "@playwright/test"

import { createApprovedSeller, createPublishedProduct, logIn, logOut, PASSWORD, resetDeliverySettings, setRole, signUpAndVerify, statusWith, uniqueEmail } from "./helpers"

// Tests that change platform-wide settings. They run in their own Playwright
// project, after every other test, so no parallel test sees a changed value.

test.describe("platform settings", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 })
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  test.beforeAll(() => resetDeliverySettings())
  test.afterAll(() => resetDeliverySettings())

  test("the Super Admin changes a delivery band and the next checkout uses it", async ({ page }) => {
    const run = Date.now().toString(36)
    const seller = { name: "Band Seller", email: uniqueEmail("bandseller") }
    const admin = { name: "Band Admin", email: uniqueEmail("bandadmin") }
    const shopper = { name: "Band Shopper", email: uniqueEmail("bandshopper") }
    await createApprovedSeller(page, seller, admin, `Band Store ${run}`)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/settings")
    await page.getByLabel("Area or suburb").fill("Madina")
    await page.getByRole("button", { name: "Save pickup location" }).click()
    await expect(statusWith(page, "Pickup location saved.")).toBeVisible()
    const productPath = await createPublishedProduct(page, { title: `Band soap ${run}`, category: "Beauty", price: "45", stock: "5" })

    await logOut(page)
    await signUpAndVerify(page, { ...shopper, password: PASSWORD })
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/account/addresses/new")
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("Kokomlemle")
    await page.getByLabel("Phone number").fill("0201234567")
    await page.getByRole("button", { name: "Use my location" }).click()
    await page.getByRole("button", { name: "Save address" }).click()
    await page.goto(productPath)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to your cart.")).toBeVisible()
    await page.goto("/checkout")
    await expect(page.getByRole("button", { name: "Place order · GH₵75.00" })).toBeVisible() // 45 + 30 (about 11 km)

    await logOut(page)
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/settings")
    await page.getByLabel("Band 3 fee in cedis").fill("35")
    await page.getByRole("button", { name: "Save delivery fees" }).click()
    await expect(statusWith(page, "Delivery fees saved.")).toBeVisible()

    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/checkout")
    await expect(page.getByRole("button", { name: "Place order · GH₵80.00" })).toBeVisible() // 45 + 35
  })

  test("the Super Admin changes a business rule; it's saved and audit-logged with before/after", async ({ page }) => {
    const admin = { name: "Rules Admin", email: uniqueEmail("rulesadmin") }
    await signUpAndVerify(page, { ...admin, password: PASSWORD })
    setRole(admin.email, "super_admin")
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/settings")
    await page.getByLabel("Ship within (days)").fill("0")
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(page.getByText("At least 1 day")).toBeVisible()
    await page.getByLabel("Ship within (days)").fill("5")
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(statusWith(page, "Saved 1 change(s).")).toBeVisible()
    await page.goto("/admin/audit?action=settings.updated")
    await expect(page.getByText(/"shipWithinDays"/).first()).toBeVisible()
    await page.goto("/admin/settings")
    await page.getByLabel("Ship within (days)").fill("3")
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(statusWith(page, "Saved 1 change(s).")).toBeVisible()
  })
})


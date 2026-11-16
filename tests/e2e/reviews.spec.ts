import { expect, test } from "@playwright/test"

import { buyAndPay, createApprovedSeller, createPublishedProduct, logIn, logOut, PASSWORD, resetDeliverySettings, signUpAndVerify, statusWith, uniqueEmail } from "./helpers"

// Verified-purchase reviews (write, show, filter, reply, hide) and the saved list.

test.describe("reviews and saved products", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only")
  test.describe.configure({ mode: "serial", timeout: 120_000 })
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  test.beforeAll(() => resetDeliverySettings())

  const run = Date.now().toString(36)
  const seller = { name: "Review Seller", email: uniqueEmail("revseller") }
  const admin = { name: "Review Admin", email: uniqueEmail("revadmin") }
  const shopper = { name: "Akua Reviewer", email: uniqueEmail("akua") }
  const title = `Reviewable soap ${run}`
  let productPath = ""
  let orderNumber = ""

  test("setup: a delivered order", async ({ page }) => {
    await createApprovedSeller(page, seller, admin, `Review Store ${run}`)
    await logIn(page, seller.email, PASSWORD)
    productPath = await createPublishedProduct(page, { title, category: "Beauty", price: "45", stock: "5" })
    await logOut(page)
    await signUpAndVerify(page, { ...shopper, password: PASSWORD })
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/account/addresses/new")
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("Kokomlemle")
    await page.getByLabel("Phone number").fill("0201234567")
    await page.getByRole("button", { name: "Save address" }).click()
    orderNumber = await buyAndPay(page, productPath)
    // Before delivery there's nothing to review.
    await expect(page.getByRole("link", { name: "Write a review" })).toHaveCount(0)
    await logOut(page)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/orders")
    await page.getByRole("link", { name: new RegExp(orderNumber) }).click()
    await page.getByLabel("Rider's name").fill("Kojo")
    await page.getByLabel("Rider's phone").fill("024 111 2222")
    await page.getByRole("button", { name: "Mark as shipped" }).click()
    await expect(statusWith(page, "Marked as shipped.")).toBeVisible()
    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(`/orders/${orderNumber}`)
    await page.getByRole("button", { name: "I received it" }).click()
    await expect(statusWith(page, "Thanks for confirming!")).toBeVisible()
  })

  test("the buyer reviews it once; the product shows the rating and the review", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(`/orders/${orderNumber}`)
    await page.getByRole("link", { name: "Write a review" }).click()
    await page.getByRole("button", { name: "Post review" }).click()
    await expect(page.getByText("Choose 1 to 5 stars")).toBeVisible()
    await page.getByLabel("4 stars").check({ force: true })
    await page.getByLabel("Your review (optional)").fill("Lovely lather and a gentle scent. Will buy again.")
    await page.getByLabel("Photo (optional)").setInputFiles("tests/e2e/fixtures/product-photo.jpg")
    await page.getByRole("button", { name: "Post review" }).click()
    await expect(statusWith(page, "Thanks for your review!")).toBeVisible()
    await expect(page.getByRole("link", { name: "Write a review" })).toHaveCount(0)

    await page.goto(productPath)
    await expect(page.getByText("4.0 (1 review)")).toBeVisible()
    await expect(page.getByText("Lovely lather and a gentle scent.")).toBeVisible()
    await expect(page.getByText("Akua R.")).toBeVisible()
    await expect(page.getByRole("img", { name: /Photo from Akua R\.'s review/ })).toBeVisible()
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("")
    expect(ld).toContain('"aggregateRating"')

    await page.goto(`/c/beauty?rating=4&sort=rating`)
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible()
  })

  test("the seller replies once, publicly", async ({ page }) => {
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/reviews")
    const card = page.getByRole("listitem").filter({ hasText: "Lovely lather" })
    await card.getByLabel("Public reply (once)").fill("Thank you, Akua!")
    await card.getByRole("button", { name: "Post reply" }).click()
    await expect(page.getByText("Your reply:")).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("Thank you, Akua!")).toBeVisible()
  })

  test("an admin hides the review and restores it; the rating follows", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/reviews")
    const card = page.getByRole("listitem").filter({ hasText: title })
    await card.getByLabel("Reason to hide").fill("Testing moderation")
    await card.getByRole("button", { name: "Hide review" }).click()
    await expect(statusWith(page, "Review hidden.")).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("No reviews yet.")).toBeVisible()
    await page.goto("/admin/reviews?view=hidden")
    await page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Show again" }).click()
    await expect(statusWith(page, "Review visible again.")).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("4.0 (1 review)")).toBeVisible()
  })

  test("shoppers save products to a list; signed-out visitors are asked to sign in", async ({ page }) => {
    await page.goto(productPath)
    await expect(page.getByRole("link", { name: "Save" })).toHaveAttribute("href", /\/login\?callbackUrl=/)
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(productPath)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true")
    await page.goto("/saved")
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible()
    await page.goto(productPath)
    await page.getByRole("button", { name: "Saved" }).click()
    await expect(page.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false")
    await page.goto("/saved")
    await expect(page.getByText("Nothing saved yet.")).toBeVisible()
  })
})

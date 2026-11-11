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
} from "./helpers"

// Paid → shipped → delivered → completed (earnings available), auto-confirm,
// a reported problem that freezes earnings until an admin resolves it,
// a late shipment the buyer cancels, and a seller cancellation.

test.describe("fulfilment journey", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only")
  test.describe.configure({ mode: "serial", timeout: 90_000 })
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  test.beforeAll(() => resetDeliverySettings())

  const run = Date.now().toString(36)
  const seller = { name: "Ama Weaves", email: uniqueEmail("amaweaves") }
  const admin = { name: "Support Admin", email: uniqueEmail("support") }
  const shopper = { name: "Kofi Shopper", email: uniqueEmail("kofishop") }
  const title = `Kente scarf ${run}`
  let productPath = ""
  const orders = { happy: "", auto: "", late: "", sellerCancel: "" }

  async function asSeller(page: Page) {
    await logOut(page)
    await logIn(page, seller.email, PASSWORD)
  }
  async function asShopper(page: Page) {
    await logOut(page)
    await logIn(page, shopper.email, PASSWORD)
  }
  async function openSellerOrder(page: Page, number: string, tab = "") {
    await page.goto(`/seller/orders${tab ? `?tab=${tab}` : ""}`)
    await page.getByRole("link", { name: new RegExp(number) }).click()
    await expect(page.getByRole("heading", { name: `Order ${number}` })).toBeVisible()
  }
  async function ship(page: Page, number: string) {
    await asSeller(page)
    await openSellerOrder(page, number)
    await page.getByLabel("Rider's name").fill("Kojo")
    await page.getByLabel("Rider's phone").fill("024 111 2222")
    await page.getByRole("button", { name: "Mark as shipped" }).click()
    await expect(statusWith(page, "Marked as shipped.")).toBeVisible()
  }

  test("setup: seller, product (stock 5) and a shopper with an address", async ({ page }) => {
    await createApprovedSeller(page, seller, admin, `Ama Weaves ${run}`)
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
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/account\/addresses\?saved=1/)
  })

  test("seller accepts and ships; the buyer sees the rider and confirms; earnings release after the hold", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    orders.happy = await buyAndPay(page, productPath)

    await asSeller(page)
    await openSellerOrder(page, orders.happy)
    await expect(page.getByText("Deliver to")).toBeVisible()
    await expect(page.getByText("+233201234567")).toBeVisible()
    await page.getByRole("button", { name: "Accept and start preparing" }).click()
    await expect(statusWith(page, "Accepted.")).toBeVisible()
    // Shipping needs the rider's phone.
    await page.getByLabel("Rider's name").fill("Kojo")
    await page.getByRole("button", { name: "Mark as shipped" }).click()
    await expect(page.getByText("Give the rider's phone number")).toBeVisible()
    await page.getByLabel("Rider's phone").fill("024 111 2222")
    await page.getByRole("button", { name: "Mark as shipped" }).click()
    await expect(statusWith(page, "Marked as shipped.")).toBeVisible()
    await linkFromEmail(shopper.email, `/orders/${orders.happy}`)

    await asShopper(page)
    await page.goto(`/orders/${orders.happy}`)
    await expect(page.getByText("On its way").first()).toBeVisible()
    await expect(page.getByRole("link", { name: "+233241112222" })).toBeVisible()
    await page.getByRole("button", { name: "I received it" }).click()
    await expect(statusWith(page, "Thanks for confirming!")).toBeVisible()
    await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible()
    await linkFromEmail(seller.email, "/seller/earnings")

    // After the 3-day hold, the daily job makes the earnings available.
    timeTravel(orders.happy, "deliveredAt", 4)
    await runDailyJobs(page) // outcome checked below (a parallel suite may run the job first)
    await asSeller(page)
    await page.goto("/seller/earnings")
    // 45 - 4.50 commission + 30 delivery
    await expect(page.getByText("Available for payout").locator("..").getByText("GH₵70.50")).toBeVisible()
    await openSellerOrder(page, orders.happy, "completed")
    await expect(page.getByText("Earnings released to the seller")).toBeVisible()
  })

  test("a shipped order nobody confirms is confirmed automatically after 7 days", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    orders.auto = await buyAndPay(page, productPath)
    await ship(page, orders.auto)
    timeTravel(orders.auto, "shippedAt", 8)
    await runDailyJobs(page) // outcome checked below (a parallel suite may run the job first)
    await openSellerOrder(page, orders.auto, "delivered") // listed under Delivered = auto-confirmed
    await linkFromEmail(seller.email, "/seller/earnings")
  })

  test("a reported problem freezes the earnings until an admin resolves it", async ({ page }) => {
    await asShopper(page)
    await page.goto(`/orders/${orders.auto}`)
    await page.getByRole("link", { name: "Report a problem" }).click()
    await page.getByLabel("What's wrong?").selectOption("faulty")
    await page.getByLabel("Tell us what happened").fill("The scarf has a long tear along one edge.")
    await page.getByLabel(/Photos/).setInputFiles("tests/e2e/fixtures/product-photo.jpg")
    await expect(page.getByText("1 photo(s) ready.")).toBeVisible()
    await page.getByRole("button", { name: "Report the problem" }).click()
    await expect(statusWith(page, "Problem reported.")).toBeVisible()
    await linkFromEmail(seller.email, "/seller/orders/")

    // Past the hold, but frozen by the open problem.
    timeTravel(orders.auto, "deliveredAt", 4)
    await runDailyJobs(page)
    await asSeller(page)
    await openSellerOrder(page, orders.auto, "delivered")
    await expect(page.getByText("Problem reported: It's faulty or damaged").first()).toBeVisible()
    await page.getByLabel("Your side (for our team)").fill("It left in perfect condition; happy to replace it.")
    await page.getByRole("button", { name: "Send response" }).click()
    await expect(statusWith(page, "Response sent")).toBeVisible()

    await logOut(page)
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/disputes")
    await page.getByRole("link", { name: new RegExp(orders.auto) }).click()
    await expect(page.getByText("It left in perfect condition")).toBeVisible()
    const photo = page.getByRole("img", { name: "Evidence photo 1" })
    await expect(photo).toBeVisible()
    expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    await page.getByLabel("Outcome").selectOption("partial_refund")
    await page.getByLabel("Refund amount (GH₵)").fill("20")
    await page.getByLabel("Note to the buyer and seller (optional)").fill("Partial refund for the tear.")
    await page.getByRole("button", { name: "Resolve" }).click()
    await expect(statusWith(page, "Resolved.")).toBeVisible()
    await linkFromEmail(shopper.email, `/orders/${orders.auto}`)

    // Now the release goes ahead (70.50 + 70.50 - 20 + commission returned 2.00 = 123.00 available).
    await runDailyJobs(page) // outcome checked below (a parallel suite may run the job first)
    await asSeller(page)
    await page.goto("/seller/earnings")
    await expect(page.getByText("Available for payout").locator("..").getByText("GH₵123.00")).toBeVisible()
  })

  test("a late shipment can be cancelled by the buyer for a full refund, and the stock returns", async ({ page }) => {
    await asShopper(page)
    orders.late = await buyAndPay(page, productPath)
    await page.goto(`/orders/${orders.late}`)
    await expect(page.getByRole("button", { name: "Cancel this part and get a refund" })).toHaveCount(0) // not before the deadline

    timeTravel(orders.late, "shipBy", 1)
    await runDailyJobs(page) // outcome checked below (a parallel suite may run the job first)
    await linkFromEmail(shopper.email, `/orders/${orders.late}`)
    await page.goto(`/orders/${orders.late}`)
    await expect(page.getByText("The seller hasn't shipped this within the time allowed.")).toBeVisible()
    await page.getByRole("button", { name: "Cancel this part and get a refund" }).click()
    await expect(statusWith(page, "cancelled and refunded in full")).toBeVisible()
    await expect(page.getByText("Refunded", { exact: true }).first()).toBeVisible()
    await page.goto(productPath)
    await expect(page.getByText("Only 3 left")).toBeVisible() // 5 - happy - auto
  })

  test("a seller who can't fulfil cancels; the buyer is refunded and told why", async ({ page }) => {
    await asShopper(page)
    orders.sellerCancel = await buyAndPay(page, productPath)
    await asSeller(page)
    await openSellerOrder(page, orders.sellerCancel)
    await page.getByText("Can't fulfil this order?").click()
    await page.getByLabel("Reason (the buyer sees it)").fill("The last one was damaged in storage")
    await page.getByRole("button", { name: "Cancel and refund the buyer" }).click()
    await expect(statusWith(page, "Cancelled.")).toBeVisible()
    await linkFromEmail(shopper.email, `/orders/${orders.sellerCancel}`)
    await page.goto(productPath)
    await expect(page.getByText("Only 3 left")).toBeVisible()
  })
})

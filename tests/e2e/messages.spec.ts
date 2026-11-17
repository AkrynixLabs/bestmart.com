import { expect, test } from "@playwright/test"

import { buyAndPay, createApprovedSeller, createPublishedProduct, linkFromEmail, logIn, logOut, PASSWORD, resetDeliverySettings, signUpAndVerify, uniqueEmail } from "./helpers"

// Buyer–seller messages: contact details are hidden in both directions until
// the buyer has paid for an order from that store.

test.describe("messages", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only")
  test.describe.configure({ mode: "serial", timeout: 120_000 })
  test.use({ geolocation: { latitude: 5.6037, longitude: -0.187 }, permissions: ["geolocation"] })
  test.beforeAll(() => resetDeliverySettings())

  const run = Date.now().toString(36)
  const seller = { name: "Chat Seller", email: uniqueEmail("chatseller") }
  const admin = { name: "Chat Admin", email: uniqueEmail("chatadmin") }
  const shopper = { name: "Yaw Asante", email: uniqueEmail("yaw") }
  const title = `Chat sneakers ${run}`
  let productPath = ""

  test("setup: a store with a product and a shopper with an address", async ({ page }) => {
    await createApprovedSeller(page, seller, admin, `Chat Store ${run}`)
    await logIn(page, seller.email, PASSWORD)
    productPath = await createPublishedProduct(page, { title, category: "Fashion", price: "120", stock: "5" })
    await logOut(page)
    await signUpAndVerify(page, { ...shopper, password: PASSWORD })
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/account/addresses/new")
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("Osu")
    await page.getByLabel("Phone number").fill("0201234567")
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/account\/addresses\?saved=1/)
  })

  test("a shopper asks about a product; their phone number is hidden from the seller", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto(productPath)
    await page.getByRole("link", { name: "Message the seller" }).click()
    await expect(page.getByRole("heading", { name: `Message Chat Store ${run}` })).toBeVisible()
    await page.getByRole("button", { name: "Send" }).click()
    await expect(page.getByText("Write a message first.")).toBeVisible()
    await page.getByLabel("Your message").fill("Do you have size 43? Call me on 024 555 1234")
    await page.getByRole("button", { name: "Send" }).click()
    await expect(page).toHaveURL(/\/messages\/[a-z0-9]+$/)
    const messages = page.getByRole("list", { name: "Messages" })
    await expect(messages).toContainText("Do you have size 43? Call me on [contact hidden]")
    await expect(messages).toContainText(`About ${title}`)
    await expect(page.getByText(/hidden until there's a paid order/)).toBeVisible()

    // The seller is emailed once and replies; their email address is hidden too.
    await linkFromEmail(seller.email, "/seller/messages/")
    await logOut(page)
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/messages")
    await expect(page.getByRole("link", { name: /Yaw A\..*New/ })).toBeVisible()
    await page.getByRole("link", { name: /Yaw A\./ }).click()
    await expect(page.getByRole("list", { name: "Messages" })).toContainText("Call me on [contact hidden]")
    await expect(page.getByRole("list", { name: "Messages" })).not.toContainText("555")
    await page.getByLabel("Reply").fill("Yes, size 43 is in stock. Or email me at chat@seller.com")
    await page.getByRole("button", { name: "Send" }).click()
    await expect(page.getByRole("list", { name: "Messages" })).toContainText("Or email me at [contact hidden]")
    await expect(page.getByLabel("Reply")).toHaveValue("")
  })

  test("after the shopper pays for an order, contact details show to both sides", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/messages")
    await expect(page.getByRole("link", { name: new RegExp(`Chat Store ${run}.*New`) })).toBeVisible()
    await buyAndPay(page, productPath)
    await page.goto("/messages")
    await page.getByRole("link", { name: new RegExp(`Chat Store ${run}`) }).click()
    const messages = page.getByRole("list", { name: "Messages" })
    await expect(messages).toContainText("chat@seller.com")
    await expect(messages).toContainText("024 555 1234")
    await expect(page.getByText(/hidden until there's a paid order/)).toHaveCount(0)
  })

  test("only the people in a conversation can open it", async ({ page }) => {
    await logIn(page, shopper.email, PASSWORD)
    await page.goto("/messages")
    await page.getByRole("link", { name: new RegExp(`Chat Store ${run}`) }).click()
    await expect(page).toHaveURL(/\/messages\/[a-z0-9]+$/)
    const url = page.url()
    await logOut(page)
    const stranger = { name: "Nosy Neighbour", email: uniqueEmail("nosy") }
    await signUpAndVerify(page, { ...stranger, password: PASSWORD })
    await logIn(page, stranger.email, PASSWORD)
    expect((await page.goto(url))?.status()).toBe(404)
    expect((await page.goto(url.replace("/messages/", "/seller/messages/")))?.status()).toBe(404)
  })
})

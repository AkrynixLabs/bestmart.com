import { expect, test } from "@playwright/test"

import { formMessage, linkFromEmail, logIn, logOut, setRole, signUpAndVerify, uniqueEmail } from "./helpers"

const PASSWORD = "testpass123"

test.describe("access control", () => {
  test("signed-out visitors are sent to login and back", async ({ page }) => {
    await page.goto("/account/addresses")
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount%2Faddresses/)
  })

  test("a wrong password gives a generic error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("nobody@example.test")
    await page.getByLabel("Password").fill("wrongpass1")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(formMessage(page)).toContainText("don't match")
  })
})

test.describe("customer to seller journey", () => {
  // One long journey; the mobile project covers layout elsewhere.
  test.skip(({ isMobile }) => isMobile, "desktop only")
  test.describe.configure({ mode: "serial" })

  const customer = { name: "Ama Mensah", email: uniqueEmail("ama"), password: PASSWORD }
  const admin = { name: "Ops Admin", email: uniqueEmail("admin"), password: PASSWORD }
  // Unique per run: earlier runs leave applications in the local database.
  const storeName = `Ama's Fabrics ${Date.now().toString(36)}`

  test("sign up, confirm email, sign in", async ({ page }) => {
    await signUpAndVerify(page, customer)
    await logIn(page, customer.email, customer.password)
    await expect(page.getByText(customer.email)).toBeVisible()
  })

  test("unverified accounts can't sign in", async ({ page }) => {
    const email = uniqueEmail("unverified")
    await page.goto("/signup")
    await page.getByLabel("Full name").fill("Kojo Unverified")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
    await page.getByLabel("Confirm password").fill(PASSWORD)
    await page.getByLabel(/I agree to the/).check()
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/verify-email\/sent/)
    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(formMessage(page)).toContainText("confirm your email")
  })

  test("add a delivery address", async ({ page }) => {
    await logIn(page, customer.email, customer.password)
    await page.goto("/account/addresses/new")
    await page.getByLabel("Region").selectOption("greater_accra")
    await page.getByLabel("Town or city").fill("Accra")
    await page.getByLabel("Area or suburb").fill("East Legon")
    await page.getByLabel(/GhanaPost GPS/).fill("ga-123-4567")
    await page.getByLabel("Phone number").fill("024 123 4567")
    await page.getByRole("button", { name: "Save address" }).click()
    await expect(page).toHaveURL(/\/account\/addresses\?saved=1/)
    await expect(page.getByText("GA-123-4567")).toBeVisible()
    await expect(page.getByText("Default")).toBeVisible()
  })

  test("apply to sell", async ({ page }) => {
    await logIn(page, customer.email, customer.password)
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
    // The page re-renders straight into the "under review" card.
    await expect(page.getByText("Your application is under review")).toBeVisible()
    await linkFromEmail(customer.email, "/sell/apply")
    // Customers can't reach the admin area (404, not a redirect that reveals it).
    const res = await page.goto("/admin")
    expect(res?.status()).toBe(404)
  })

  test("an admin approves the application and a store is created", async ({ page }) => {
    await signUpAndVerify(page, admin)
    setRole(admin.email, "ops_admin")
    await logIn(page, admin.email, admin.password)
    await page.goto("/admin/seller-applications")
    await page.getByRole("link", { name: storeName }).click()
    await expect(page.getByRole("img", { name: /Ghana Card submitted by Ama Mensah/ })).toBeVisible()
    await page.getByRole("button", { name: "Approve and create store" }).click()
    await expect(page.getByText("Application approved")).toBeVisible()
    await linkFromEmail(customer.email, "/seller")
  })

  test("the new seller sees their dashboard", async ({ page }) => {
    await logOut(page)
    await logIn(page, customer.email, customer.password)
    await page.goto("/seller")
    await expect(page.getByRole("heading", { name: storeName })).toBeVisible()
    await expect(page.getByText(/MTN ending 4567/)).toBeVisible()
  })
})

test("password reset with an emailed link", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only")
  const user = { name: "Esi Reset", email: uniqueEmail("esi"), password: PASSWORD }
  await signUpAndVerify(page, user)
  await page.goto("/forgot-password")
  await page.getByLabel("Email").fill(user.email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(formMessage(page, "status")).toContainText("If an account exists")
  await page.goto(await linkFromEmail(user.email, "/reset-password?token="))
  await page.getByLabel("New password", { exact: true }).fill("brandnew456")
  await page.getByLabel("Confirm new password").fill("brandnew456")
  await page.getByRole("button", { name: "Save new password" }).click()
  await expect(page).toHaveURL(/\/login\?reset=1/)
  await logIn(page, user.email, "brandnew456")
})

test("submitting the sign-in form after signing in from another tab doesn't crash", async ({ context, isMobile }) => {
  test.skip(isMobile, "desktop only")
  const user = { name: "Two Tabs", email: uniqueEmail("tabs"), password: PASSWORD }
  const setup = await context.newPage()
  await signUpAndVerify(setup, user)
  await setup.close()

  // Tab A: the sign-in form, opened while signed out.
  const tabA = await context.newPage()
  await tabA.goto("/login")
  await tabA.getByLabel("Email").fill(user.email)
  await tabA.getByLabel("Password").fill(user.password)
  // Tab B: signs in first.
  const tabB = await context.newPage()
  await logIn(tabB, user.email, user.password)
  // Back in tab A, the form still works (it used to hit a redirect and show the error page).
  await tabA.getByRole("button", { name: "Sign in" }).click()
  await expect(tabA).toHaveURL(/\/account$/)
  await expect(tabA.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0)
})

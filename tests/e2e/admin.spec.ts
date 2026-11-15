import { expect, test } from "@playwright/test"

import { createApprovedSeller, formMessage, freshTotp, logIn, logOut, PASSWORD, rememberTotpSecret, setRole, signUpAndVerify, statusWith, uniqueEmail } from "./helpers"

// The admin area: two-factor sign-in (setup, verification, recovery codes),
// people management (suspensions, roles), reports with CSV, the audit log.

test.describe("admin area", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only")
  test.describe.configure({ mode: "serial", timeout: 90_000 })

  const run = Date.now().toString(36)
  const ops = { name: "New Ops", email: uniqueEmail("newops"), password: PASSWORD }
  const seller = { name: "Store Owner", email: uniqueEmail("owner") }
  const superAdmin = { name: "The Super Admin", email: uniqueEmail("thesuper") }
  const customer = { name: "Plain Customer", email: uniqueEmail("plain"), password: PASSWORD }
  const storeName = `Suspend Me ${run}`
  let recoveryCode = ""

  async function rawLogIn(page: import("@playwright/test").Page, email: string) {
    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/account$/)
  }

  test("a new admin must set up two-factor before the admin area opens", async ({ page }) => {
    await signUpAndVerify(page, ops)
    setRole(ops.email, "ops_admin", { twoFactor: false })
    await rawLogIn(page, ops.email)
    await page.goto("/admin/orders")
    await expect(page).toHaveURL(/\/account\/two-factor\?next=%2Fadmin%2Forders/)
    await expect(page.getByRole("heading", { name: "Set up two-factor sign-in" })).toBeVisible()
    const key = (await page.getByLabel("Setup key").textContent())!.replace(/\s/g, "")
    expect(key).toMatch(/^[A-Z2-7]{32}$/)
    rememberTotpSecret(ops.email, key)

    await page.getByLabel("6-digit code from the app").fill("000000")
    await page.getByRole("button", { name: "Turn on two-factor sign-in" }).click()
    await expect(page.getByText("That code didn't match")).toBeVisible()
    await page.getByLabel("6-digit code from the app").fill(await freshTotp(ops.email)) // tracked, so later sign-ins don't reuse it
    await page.getByRole("button", { name: "Turn on two-factor sign-in" }).click()
    const codes = page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem")
    await expect(codes).toHaveCount(8)
    recoveryCode = (await codes.first().textContent())!.trim()
    await page.getByRole("link", { name: /I've saved them/ }).click()
    await expect(page).toHaveURL(/\/admin\/orders$/)
  })

  test("after signing in again: a code is required, a recovery code works once", async ({ page }) => {
    await rawLogIn(page, ops.email)
    await page.goto("/admin")
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible()
    await page.getByLabel("Code").fill("123456")
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByText("That code isn't right")).toBeVisible()
    await page.getByLabel("Code").fill(recoveryCode)
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByText("7 recovery codes left")).toHaveCount(0) // not on the admin page

    await logOut(page)
    await rawLogIn(page, ops.email)
    await page.goto("/account/two-factor?next=/admin")
    await expect(page.getByText("7 recovery codes left")).toBeVisible()
    await page.getByLabel("Code").fill(recoveryCode)
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByText("That code isn't right (or was already used)")).toBeVisible()
  })

  test("ops admins can't open money pages; customers get 404 for all of admin", async ({ page }) => {
    await logIn(page, ops.email, PASSWORD)
    for (const path of ["/admin/reports", "/admin/audit", "/admin/payouts", "/admin/settings"]) {
      expect((await page.goto(path))?.status(), path).toBe(404)
    }
    await logOut(page)
    await signUpAndVerify(page, customer)
    await logIn(page, customer.email, PASSWORD)
    expect((await page.goto("/admin/users"))?.status()).toBe(404)
  })

  test("suspending a store hides it; suspending an account blocks sign-in; both can be undone", async ({ page }) => {
    await createApprovedSeller(page, seller, superAdmin, storeName)
    const storePath = `/s/${storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    expect((await page.goto(storePath))?.status()).toBe(200)

    await logIn(page, superAdmin.email, PASSWORD)
    await page.goto(`/admin/users?q=${encodeURIComponent(seller.email)}`)
    await page.getByRole("link", { name: new RegExp(seller.name) }).click()
    const store = page.getByRole("region", { name: "Store" })
    await store.getByRole("button", { name: "Suspend store" }).click()
    await expect(store.getByText("Give a reason")).toBeVisible()
    await store.getByLabel("Reason (kept in the audit log)").fill("Selling counterfeit goods")
    await store.getByRole("button", { name: "Suspend store" }).click()
    await expect(statusWith(page, "Store suspended.")).toBeVisible()
    expect((await page.request.get(storePath)).status()).toBe(404)
    await page.getByRole("region", { name: "Store" }).getByRole("button", { name: "Reinstate store" }).click()
    await expect(statusWith(page, "Store reinstated.")).toBeVisible()
    expect((await page.request.get(storePath)).status()).toBe(200)

    await page.goto(`/admin/users?q=${encodeURIComponent(customer.email)}`)
    await page.getByRole("link", { name: new RegExp(customer.name) }).click()
    const account = page.getByRole("region", { name: "Account" })
    await account.getByLabel("Reason (kept in the audit log)").fill("Chargeback fraud")
    await account.getByRole("button", { name: "Suspend account" }).click()
    await expect(statusWith(page, "Account suspended.")).toBeVisible()

    await logOut(page)
    await page.goto("/login")
    await page.getByLabel("Email").fill(customer.email)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(formMessage(page)).toContainText("suspended")

    await logIn(page, superAdmin.email, PASSWORD)
    await page.goto(`/admin/users?q=${encodeURIComponent(customer.email)}`)
    await page.getByRole("link", { name: new RegExp(customer.name) }).click()
    await page.getByRole("button", { name: "Reinstate account" }).click()
    await expect(statusWith(page, "Account reinstated.")).toBeVisible()
  })

  test("the Super Admin makes a customer an ops admin, who then has to set up two-factor", async ({ page }) => {
    await logIn(page, superAdmin.email, PASSWORD)
    await page.goto(`/admin/users?q=${encodeURIComponent(customer.email)}`)
    await page.getByRole("link", { name: new RegExp(customer.name) }).click()
    await page.getByRole("button", { name: "Make ops admin" }).click()
    await expect(statusWith(page, "Now an ops admin.")).toBeVisible()
    await logOut(page)
    await rawLogIn(page, customer.email)
    await page.goto("/admin")
    await expect(page.getByRole("heading", { name: "Set up two-factor sign-in" })).toBeVisible()
  })

  test("reports show the period's money and download as CSV; the export is audit-logged", async ({ page }) => {
    await logIn(page, superAdmin.email, PASSWORD)
    await page.goto("/admin/reports?preset=last_30")
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()
    await expect(page.getByText("Net platform revenue")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Day by day" })).toBeVisible()
    const href = await page.getByRole("link", { name: "Download CSV" }).getAttribute("href")
    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("text/csv")
    const csv = await res.text()
    expect(csv).toContain("BestMart report")
    expect(csv).toContain("Net platform revenue")

    await page.goto("/admin/audit?action=report.exported")
    await expect(page.getByText("report.exported").first()).toBeVisible()
    await page.goto("/admin/audit?action=store.suspended")
    await expect(page.getByText("Selling counterfeit goods").first()).toBeVisible()
  })
})

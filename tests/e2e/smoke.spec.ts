import { expect, test } from "@playwright/test"

test("home page renders the storefront shell", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveTitle(/BestMart/)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Shop trusted sellers across Ghana")
  await expect(page.getByRole("heading", { name: "Shop by category" })).toBeVisible()
  await expect(page.getByText("Electronics")).toBeVisible()
  // No horizontal scroll at any viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test("unknown pages return a friendly 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist")
  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible()
})

test("health endpoints answer", async ({ request }) => {
  const live = await request.get("/api/health")
  expect(live.ok()).toBe(true)
  const ready = await request.get("/api/health/ready")
  expect(ready.ok()).toBe(true)
  expect(await ready.json()).toMatchObject({ checks: { database: "ok" } })
})

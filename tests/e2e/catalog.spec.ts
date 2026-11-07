import { expect, test } from "@playwright/test"

import { createApprovedSeller, linkFromEmail, logIn, logOut, PASSWORD, statusWith, uniqueEmail } from "./helpers"

// One journey through the catalog: an admin builds a category with an
// attribute, a seller lists a product with variants and a photo, a shopper
// finds it by category, filter and search, and an admin moderates it.
// Names are unique per run because the local database keeps earlier data.

test.describe("catalog journey", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only (mobile layout is covered by the smoke tests)")
  test.describe.configure({ mode: "serial" })

  const run = Date.now().toString(36)
  const seller = { name: "Kofi Boateng", email: uniqueEmail("kofi") }
  const admin = { name: "Super Admin", email: uniqueEmail("super") }
  const storeName = `Kofi Gadgets ${run}`
  const categoryName = `Phones ${run}`
  const categorySlug = `phones-${run}`
  const brand = `Brand ${run}`
  const title = `Zentra X${run} smartphone`
  let productPath = "" // seller's edit page
  let productUrl = "" // public product page

  test("setup: an approved seller and a super admin", async ({ page }) => {
    await createApprovedSeller(page, seller, admin, storeName)
  })

  test("an admin adds a subcategory with a required, filterable attribute", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/categories/new?parent=cat_electronics")
    await page.getByLabel("Name").fill(categoryName)
    await page.getByLabel("Web address").fill(categorySlug)
    await expect(page.getByLabel("Parent category")).toHaveValue("cat_electronics")
    await page.getByRole("button", { name: "Create category" }).click()
    await expect(page.getByText("Category created.")).toBeVisible()

    const add = page.getByRole("region", { name: "Add an attribute" })
    await add.getByLabel("Name").fill(brand)
    await add.getByLabel("Type").selectOption("select")
    await add.getByLabel("Choices").fill("Zentra, Samsung, Tecno")
    await add.getByLabel("Required to publish").check()
    await add.getByRole("button", { name: "Add attribute" }).click()
    await expect(statusWith(page, `Attribute "${brand}" added.`)).toBeVisible()

    // It's on the storefront straight away (no deploy, no cache delay).
    await logOut(page)
    await page.goto(`/c/${categorySlug}`)
    await expect(page.getByRole("heading", { level: 1, name: categoryName })).toBeVisible()
    await expect(page.getByText("No products in this category yet.")).toBeVisible()
  })

  test("a seller lists a product with options, a photo and the attribute, then publishes", async ({ page }) => {
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/products/new")
    await page.getByLabel("Product name").fill(title)
    await page.getByLabel("Category").selectOption({ label: `Electronics › ${categoryName}` })
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByText("Draft created.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled()
    productPath = new URL(page.url()).pathname

    // A 2400×1800 photo is shrunk in the browser to 1600 px JPEG before upload.
    await page.getByLabel("Add product photos").setInputFiles("tests/e2e/fixtures/product-photo.jpg")
    const photo = page.getByRole("img", { name: `${title}, photo 1` })
    await expect(photo).toBeVisible()
    await expect(photo).toHaveAttribute("src", /\.jpg$/)
    expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1600)

    await page.getByLabel("Description").fill("A dual-SIM smartphone with a 6.5 inch screen, 5000 mAh battery and fast charging. Comes with a charger and case.")
    await page.getByLabel(`${brand} (required)`).selectOption("Zentra")
    await page.getByRole("button", { name: "Save details" }).click()
    await expect(statusWith(page, "Details saved.")).toBeVisible()

    await page.getByRole("button", { name: "Add an option" }).click()
    await page.getByLabel("Option name").fill("Storage")
    await page.getByLabel("Values, separated by commas").fill("64GB, 128GB")
    await page.getByRole("button", { name: "Update variants (2)" }).click()
    await page.getByLabel("Price for 64GB", { exact: true }).fill("1200")
    await page.getByLabel("Stock for 64GB", { exact: true }).fill("10")
    await page.getByLabel("Price for 128GB", { exact: true }).fill("1500")
    await page.getByLabel("Was-price for 128GB").fill("1650")
    await page.getByLabel("Stock for 128GB", { exact: true }).fill("3")
    await page.getByRole("button", { name: "Save prices and stock" }).click()
    await expect(statusWith(page, "Variants saved.")).toBeVisible()

    await expect(page.getByText("Ready to publish.")).toBeVisible()
    await page.getByRole("button", { name: "Publish" }).click()
    await expect(statusWith(page, "Published.")).toBeVisible()
  })

  test("shoppers find it by category, filter and search, and pick a variant", async ({ page }) => {
    await page.goto(`/c/${categorySlug}`)
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible()

    // Filter by the admin-defined attribute.
    await page.getByLabel("Samsung").check()
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page.getByText("No products match these filters.")).toBeVisible()
    await page.getByLabel("Samsung").uncheck()
    await page.getByLabel("Zentra").check()
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page).toHaveURL(/a\.[a-z0-9_]+=Zentra/)
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible()

    // The parent category includes its subcategories' products.
    await page.goto("/c/electronics")
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible()

    // Search (typo-tolerant title match on the unique model number).
    await page.goto("/")
    await page.getByRole("searchbox", { name: "Search products and sellers" }).fill(`X${run}`)
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/search\?q=/)
    await page.getByRole("link", { name: new RegExp(title) }).click()

    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible()
    productUrl = new URL(page.url()).pathname
    await expect(page.getByText("GH₵1,200.00")).toBeVisible()
    await page.getByRole("button", { name: "128GB" }).click()
    await expect(page.getByText("GH₵1,500.00")).toBeVisible()
    await expect(page.getByText("Only 3 left")).toBeVisible()
    await expect(page.getByRole("link", { name: storeName })).toBeVisible()
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(jsonLd.join("")).toContain('"@type":"Product"')
  })

  test("a seller's category suggestion becomes a category when accepted", async ({ page }) => {
    const suggestion = `Smartwatches ${run}`
    await logIn(page, seller.email, PASSWORD)
    await page.goto("/seller/categories")
    await page.getByLabel("Category name").fill(suggestion)
    await page.getByLabel("Where should it go?").selectOption("cat_electronics")
    await page.getByRole("button", { name: "Send suggestion" }).click()
    await expect(statusWith(page, "Our team will review")).toBeVisible()

    await logOut(page)
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/category-suggestions")
    const card = page.getByRole("listitem").filter({ hasText: suggestion }).first()
    await card.getByRole("button", { name: "Add category" }).click()
    await expect(statusWith(page, `Added “${suggestion}”`)).toBeVisible()
    await linkFromEmail(seller.email, "/seller/products/new")
  })

  test("renaming a category's address keeps the old link working", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto("/admin/categories")
    await page.getByRole("link", { name: categoryName, exact: true }).click()
    const details = page.getByRole("region", { name: "Details" })
    await details.getByLabel("Web address").fill(`${categorySlug}-new`)
    await details.getByRole("button", { name: "Save category" }).click()
    await expect(statusWith(page, "Category saved.")).toBeVisible()

    await logOut(page)
    await page.goto(`/c/${categorySlug}?sort=price_asc`)
    await expect(page).toHaveURL(new RegExp(`/c/${categorySlug}-new\\?sort=price_asc$`))
  })

  test("an admin blocks the listing: shoppers get a 404, the seller is told why", async ({ page }) => {
    await logIn(page, admin.email, PASSWORD)
    await page.goto(`/admin/products?q=${encodeURIComponent(title)}`)
    await page.getByText(title).click()
    await page.getByLabel("Reason (sent to the seller)").fill("Test listing, please ignore.")
    await page.getByRole("button", { name: "Block listing" }).click()
    await expect(statusWith(page, "Blocked.")).toBeVisible()
    await linkFromEmail(seller.email, productPath)

    await logOut(page)
    expect((await page.goto(productUrl))?.status()).toBe(404)
    await page.goto(`/c/${categorySlug}-new`)
    await expect(page.getByText("No products in this category yet.")).toBeVisible()

    await logIn(page, seller.email, PASSWORD)
    await page.goto(productPath)
    await expect(page.getByText("Blocked by BestMart.")).toBeVisible()
    await expect(page.getByText("Test listing, please ignore.")).toBeVisible()
  })

  test("sitemaps list categories and stay valid XML", async ({ request }) => {
    const index = await request.get("/sitemap.xml")
    expect(index.status()).toBe(200)
    expect(await index.text()).toContain("/sitemaps/pages.xml")
    const pages = await (await request.get("/sitemaps/pages.xml")).text()
    expect(pages).toContain(`/c/${categorySlug}-new`)
    expect(pages).toContain("/c/electronics")
  })
})

test("catalog pages fit a phone screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only")
  for (const path of ["/c/electronics", "/search?q=phone", "/search", "/cart"]) {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
  await page.goto("/c/electronics")
  await page.getByText("Sort and filter").click()
  await expect(page.getByLabel("Sort by")).toBeVisible()
})

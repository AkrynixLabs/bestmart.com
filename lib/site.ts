import { stripTrailingSlash } from "./utils"

export const site = {
  name: "BestMart",
  tagline: "Publish · Advertise · Sell",
  description:
    "Shop from trusted, verified sellers across Ghana. Pay with Mobile Money or card, and your money is protected until your order arrives.",
  locale: "en_GH",
} as const

/** Public base URL without a trailing slash. Safe in server and client code. */
export function appUrl(): string {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
}

export const launchCategories = [
  { slug: "electronics", name: "Electronics", image: "/images/categories/electronics.jpg" },
  { slug: "fashion", name: "Fashion", image: "/images/categories/fashion.jpg" },
  { slug: "beauty", name: "Beauty", image: "/images/categories/beauty.jpg" },
  { slug: "home-living", name: "Home & Living", image: "/images/categories/home-living.jpg" },
  { slug: "sports", name: "Sports", image: "/images/categories/sports.jpg" },
  { slug: "groceries", name: "Groceries", image: "/images/categories/groceries.jpg" },
] as const

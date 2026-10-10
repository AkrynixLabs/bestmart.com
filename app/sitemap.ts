import type { MetadataRoute } from "next"

import { appUrl } from "@/lib/site"

// Phase 2 adds categories, products and seller stores from the database.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${appUrl()}/`, changeFrequency: "daily", priority: 1 }]
}

import type { MetadataRoute } from "next"

import { appUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/account/", "/seller/", "/admin/", "/cart", "/checkout", "/orders", "/dev/"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  }
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Vercel env values sometimes carry a trailing slash; concatenating that with
// a leading-slash path produces "//path" (a real bug TutorLane hit in
// sitemaps, Paystack callbacks and email links).
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

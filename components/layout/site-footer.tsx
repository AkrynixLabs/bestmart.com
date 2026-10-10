import { site } from "@/lib/site"

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t bg-brand-navy text-white/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-lg font-bold text-white">{site.name}</p>
          <p className="mt-1 text-sm">{site.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Buyer protection</p>
          <p className="mt-1">Your payment is held safely until you confirm your order arrived.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Pay your way</p>
          <p className="mt-1">Mobile Money (MTN, Telecel, AirtelTigo) and cards, secured by Paystack.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs sm:px-6">
          © {year} {site.name}. Made in Ghana.
        </p>
      </div>
    </footer>
  )
}

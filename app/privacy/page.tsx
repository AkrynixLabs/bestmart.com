import type { Metadata } from "next"

import { site } from "@/lib/site"

export const metadata: Metadata = { title: "Privacy" }

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm">
        Draft: a plain-language summary while {site.name} prepares for launch. The full privacy policy will replace it before the first sale.
      </p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Privacy</h1>
      <div className="mt-6 grid gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>We collect what we need to run the marketplace: your name, email, phone number and delivery addresses, and for sellers, identity and payout details.</p>
        <p>
          Sellers&apos; Ghana Card images are stored privately and seen only by our review team; every view is logged. Card payments are handled by Paystack; we never
          see or store card numbers.
        </p>
        <p>We share your delivery details only with the seller fulfilling your order. We don&apos;t sell your data.</p>
        <p>You can ask us to correct or delete your data at any time.</p>
      </div>
    </article>
  )
}

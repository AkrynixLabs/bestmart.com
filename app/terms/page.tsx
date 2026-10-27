import type { Metadata } from "next"

import { site } from "@/lib/site"

export const metadata: Metadata = { title: "Terms" }

// Draft summary of the agreed rules (CLAUDE.md). The full terms, seller
// agreement and returns policy will be lawyer-reviewed before launch.
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm">
        Draft: these terms are a plain-language summary while {site.name} prepares for launch. The full legal terms will replace them before the first sale.
      </p>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Terms of use</h1>
      <div className="mt-6 grid gap-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground">
        <section>
          <h2>Buyers</h2>
          <p>
            You pay {site.name} through Paystack (Mobile Money or card). We hold your payment and release it to the seller only after you confirm your order arrived,
            or automatically 7 days after the seller marks it shipped if you don&apos;t report a problem. You can request a return within 7 days of delivery if an
            item is faulty or not as described.
          </p>
        </section>
        <section id="sellers">
          <h2>Sellers</h2>
          <p>
            Sellers must be approved before listing, using true identity and payout details. {site.name} charges a commission (currently 10%) on the item price of
            each sale; delivery fees are not commissioned. Your earnings become available for payout 3 days after delivery is confirmed, if no dispute is open, and
            are paid to the Mobile Money or bank account you provided. Counterfeit, illegal or misdescribed goods are not allowed and lead to removal and
            suspension.
          </p>
        </section>
        <section>
          <h2>Accounts</h2>
          <p>Keep your password private. We may suspend accounts used for fraud or abuse.</p>
        </section>
      </div>
    </article>
  )
}

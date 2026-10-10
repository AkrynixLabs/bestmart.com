import Image from "next/image"
import { BadgeCheck, ShieldCheck, Smartphone, Truck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { launchCategories, site } from "@/lib/site"

const promises = [
  {
    icon: BadgeCheck,
    title: "Verified sellers",
    body: "Every seller is checked (Ghana Card, phone and payout account) before they can list a single product.",
  },
  {
    icon: ShieldCheck,
    title: "Your money is protected",
    body: "We hold your payment and only release it to the seller after you confirm your order arrived.",
  },
  {
    icon: Smartphone,
    title: "Pay with MoMo or card",
    body: "MTN, Telecel and AirtelTigo Mobile Money, plus Visa and Mastercard, secured by Paystack.",
  },
  {
    icon: Truck,
    title: "Delivered to you",
    body: "Clear delivery fees by zone, starting in Accra and Tema, with tracking from paid to delivered.",
  },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-orange-light">
              Opening soon in Accra
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Shop trusted sellers across Ghana.{" "}
              <span className="text-brand-orange">Pay only when it&apos;s safe.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">{site.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <a href="#categories">Browse categories</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                <a href="#sell">Become a seller</a>
              </Button>
            </div>
          </div>
          <div className="relative hidden md:block">
            <Image
              src="/brand/logo-glow.png"
              alt=""
              width={1000}
              height={667}
              priority
              className="mx-auto w-full max-w-lg rounded-2xl"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="promises-heading" className="border-b bg-muted/60">
        <h2 id="promises-heading" className="sr-only">
          Why shop on {site.name}
        </h2>
        <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {promises.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-6 shrink-0 text-brand-blue" aria-hidden />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="categories" aria-labelledby="categories-heading" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 id="categories-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          Shop by category
        </h2>
        <p className="mt-2 text-muted-foreground">Products from our first verified sellers will appear here at launch.</p>
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {launchCategories.map((category) => (
            <li key={category.slug} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
              <Image
                src={category.image}
                alt=""
                fill
                sizes="(min-width: 768px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/85 via-brand-navy/20 to-transparent" />
              <p className="absolute bottom-3 left-4 text-lg font-bold text-white">{category.name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="sell" aria-labelledby="sell-heading" className="scroll-mt-20 bg-secondary">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 id="sell-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Sell on {site.name}
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Reach buyers across Ghana without building your own website. List your products, get paid to your Mobile
              Money wallet or bank account, and let us handle payments and buyer trust.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li>✓ Free to apply. We take a commission only when you make a sale.</li>
              <li>✓ Payouts straight to MoMo or your bank account.</li>
              <li>✓ A dashboard for products, stock, orders and earnings.</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <p className="font-semibold">Seller applications open soon</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ll need your Ghana Card, a phone number and a Mobile Money or bank account for payouts.
            </p>
            <Button className="mt-5 w-full" disabled>
              Apply to sell (opening soon)
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

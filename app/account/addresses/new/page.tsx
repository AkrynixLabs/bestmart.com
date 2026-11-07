import type { Metadata } from "next"

import { requireUser } from "@/lib/auth/session"

import { AddressForm } from "../address-form"

export const metadata: Metadata = { title: "Add address" }

export default async function NewAddressPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const user = await requireUser("/account/addresses/new")
  const returnTo = (await searchParams).returnTo === "/checkout" ? "/checkout" : undefined
  return (
    <section className="rounded-xl border bg-card p-6">
      <h1 className="text-xl font-bold">Add a delivery address</h1>
      <div className="mt-6">
        <AddressForm defaults={{ recipientName: user.name, phone: user.phone ?? "" }} returnTo={returnTo} />
      </div>
    </section>
  )
}

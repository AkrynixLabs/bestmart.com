import type { Metadata } from "next"
import Link from "next/link"
import { MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { regionLabel } from "@/lib/validation/common"

import { deleteAddressAction, setDefaultAddressAction } from "../actions"

export const metadata: Metadata = { title: "Delivery addresses" }

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser("/account/addresses")
  const { saved } = await searchParams
  const addresses = await prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Delivery addresses</h1>
          <p className="text-sm text-muted-foreground">Where sellers deliver your orders.</p>
        </div>
        <Button asChild>
          <Link href="/account/addresses/new">Add address</Link>
        </Button>
      </div>
      {saved ? (
        <p role="status" className="rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
          Address saved.
        </p>
      ) : null}
      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <MapPin className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No addresses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add one now so checkout is quicker.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{a.label || a.recipientName}</p>
                {a.isDefault ? <Badge variant="secondary">Default</Badge> : null}
              </div>
              <address className="mt-2 text-sm not-italic text-muted-foreground">
                {a.recipientName} · {a.phone}
                <br />
                {[a.streetAddress, a.area, a.city].filter(Boolean).join(", ")}
                <br />
                {regionLabel[a.region]}
                {a.gpsAddress ? ` · ${a.gpsAddress}` : ""}
                {a.landmark ? (
                  <>
                    <br />
                    Landmark: {a.landmark}
                  </>
                ) : null}
              </address>
              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/account/addresses/${a.id}`}>Edit</Link>
                </Button>
                {!a.isDefault ? (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="addressId" value={a.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Make default
                    </Button>
                  </form>
                ) : null}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="addressId" value={a.id} />
                  <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                    Remove
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

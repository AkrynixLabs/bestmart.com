import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

import { AddressForm } from "../address-form"

export const metadata: Metadata = { title: "Edit address" }

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/account/addresses/${id}`)
  const address = await prisma.address.findFirst({ where: { id, userId: user.id } })
  if (!address) notFound()
  const { label, recipientName, phone, region, city, area, streetAddress, landmark, gpsAddress, isDefault, latitude, longitude } = address
  return (
    <section className="rounded-xl border bg-card p-6">
      <h1 className="text-xl font-bold">Edit address</h1>
      <div className="mt-6">
        <AddressForm
          addressId={address.id}
          defaults={{
            label: label ?? "",
            recipientName,
            phone,
            region,
            city,
            area,
            streetAddress: streetAddress ?? "",
            landmark: landmark ?? "",
            gpsAddress: gpsAddress ?? "",
            isDefault,
            pin: latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null,
          }}
        />
      </div>
    </section>
  )
}

import type { Metadata } from "next"

import { requireSellerStore } from "@/lib/catalog/seller"
import { prisma } from "@/lib/prisma"

import { PickupForm } from "./pickup-form"

export const metadata: Metadata = { title: "Store settings", robots: { index: false } }

export default async function SellerSettingsPage() {
  const { store } = await requireSellerStore("/seller/settings")
  const pickup = await prisma.store.findUniqueOrThrow({ where: { id: store.id }, select: { pickupArea: true, pickupLatitude: true, pickupLongitude: true } })
  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pickup location</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery fees are based on the distance from here to each buyer, and you receive the delivery fee with every order.
        </p>
      </div>
      <PickupForm
        area={pickup.pickupArea ?? ""}
        city={store.city}
        pin={pickup.pickupLatitude !== null && pickup.pickupLongitude !== null ? { lat: pickup.pickupLatitude, lng: pickup.pickupLongitude } : null}
      />
    </div>
  )
}

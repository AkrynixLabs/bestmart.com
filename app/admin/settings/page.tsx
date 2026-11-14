import type { Metadata } from "next"

import { requireRole } from "@/lib/auth/session"
import { feeForKm, readBands } from "@/lib/delivery/fee"
import { formatBps, formatGhs, toCediInput } from "@/lib/money"
import { getPlatformSettings } from "@/lib/platform-settings"

import { DeliverySettingsForm } from "./delivery-form"
import { GeneralSettingsForm } from "./general-form"

export const metadata: Metadata = { title: "Settings" }

const EXAMPLES = [
  { label: "East Legon → Madina", km: 6 },
  { label: "Accra Central → Tema", km: 32 },
  { label: "Accra → Kumasi", km: 260 },
]

export default async function AdminSettingsPage() {
  await requireRole(["super_admin"], "/admin/settings")
  const settings = await getPlatformSettings()
  const bands = readBands(settings.deliveryBands)
  return (
    <div className="grid max-w-3xl gap-8">
      <section className="grid gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every business rule BestMart runs on. Changes are logged and apply to new orders.</p>
        </div>
        <GeneralSettingsForm
          initial={{
            commissionPercent: formatBps(settings.commissionBps),
            stockReservationMinutes: String(settings.stockReservationMinutes),
            shipWithinDays: String(settings.shipWithinDays),
            autoConfirmDeliveryDays: String(settings.autoConfirmDeliveryDays),
            payoutHoldDays: String(settings.payoutHoldDays),
            returnWindowDays: String(settings.returnWindowDays),
            lowStockThreshold: String(settings.lowStockThreshold),
            payoutMinimum: toCediInput(settings.payoutMinimum),
            payoutWeekday: String(settings.payoutWeekday),
            supportEmail: settings.supportEmail ?? "",
            supportPhone: settings.supportPhone ?? "",
          }}
        />
      </section>
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold tracking-tight">Delivery fees</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One fee per seller in an order, paid to the seller. Distance is measured between the seller&apos;s pickup pin and the buyer&apos;s address pin, or estimated between neighbourhoods or towns when a pin is missing.
        </p>
      </div>
      <DeliverySettingsForm initialRows={bands.map((b) => ({ upToKm: b.upToKm === null ? "" : String(b.upToKm), fee: toCediInput(b.feePesewas) }))} roadFactorPct={settings.deliveryRoadFactorPct} />
      <section className="rounded-xl bg-muted/50 p-4 text-sm">
        <h2 className="font-medium">With the saved settings</h2>
        <ul className="mt-2 grid gap-1">
          {EXAMPLES.map((e) => (
            <li key={e.label} className="flex justify-between gap-3">
              <span>
                {e.label} <span className="text-muted-foreground">(about {e.km} km by road)</span>
              </span>
              <span className="font-medium tabular-nums">{formatGhs(feeForKm(bands, e.km))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

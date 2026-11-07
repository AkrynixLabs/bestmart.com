"use client"

import "leaflet/dist/leaflet.css"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Map as LeafletMap, Marker } from "leaflet"
import { Crosshair, Loader2, MapPin, X } from "lucide-react"

import { Button } from "@/components/ui/button"

// A small OpenStreetMap map for setting a delivery or pickup pin. Tap the map
// (or "Use my location") to drop the pin, drag it to adjust. The values go in
// hidden `latitude` / `longitude` inputs; an empty pin is allowed (delivery is
// then estimated from the area/town). Leaflet is loaded only in the browser.

type Pin = { lat: number; lng: number }

const ACCRA: Pin = { lat: 5.6037, lng: -0.187 }
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

export function LocationPicker({ initial, error, hint }: { initial?: Pin | null; error?: string; hint?: string }) {
  const [pin, setPin] = useState<Pin | null>(initial ?? null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const leaflet = useRef<typeof import("leaflet") | null>(null)

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    let created: LeafletMap | null = null
    void import("leaflet").then((L) => {
      if (cancelled || !container.current) return
      leaflet.current = L
      const start = initial ?? ACCRA
      created = L.map(container.current, { center: [start.lat, start.lng], zoom: initial ? 16 : 11, scrollWheelZoom: false })
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(created)
      created.on("click", (e) => setPin({ lat: e.latlng.lat, lng: e.latlng.lng }))
      map.current = created
      setPin((p) => (p ? { ...p } : p)) // draw an initial marker
    })
    return () => {
      cancelled = true
      created?.remove()
      map.current = null
      marker.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the marker in step with the pin.
  useEffect(() => {
    const L = leaflet.current
    if (!L || !map.current) return
    if (!pin) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (!marker.current) {
      const icon = L.divIcon({ className: "bm-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 28] })
      marker.current = L.marker([pin.lat, pin.lng], { draggable: true, icon, keyboard: true, title: "Delivery location" }).addTo(map.current)
      marker.current.on("dragend", () => {
        const p = marker.current?.getLatLng()
        if (p) setPin({ lat: p.lat, lng: p.lng })
      })
    } else {
      marker.current.setLatLng([pin.lat, pin.lng])
    }
  }, [pin])

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser can't share its location. Tap the map instead.")
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPin(p)
        map.current?.setView([p.lat, p.lng], 17)
        setLocating(false)
      },
      () => {
        setGeoError("We couldn't get your location. Check the permission, or tap the map instead.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }, [])

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="size-4 text-brand-blue" aria-hidden /> Map pin (optional)
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" aria-hidden /> : <Crosshair aria-hidden />} Use my location
          </Button>
          {pin ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setPin(null)}>
              <X aria-hidden /> Remove pin
            </Button>
          ) : null}
        </div>
      </div>
      <div ref={container} className="h-64 w-full overflow-hidden rounded-lg border bg-muted" role="application" aria-label="Map. Tap to place the pin, drag the pin to adjust it." />
      <input type="hidden" name="latitude" value={pin ? pin.lat.toFixed(6) : ""} />
      <input type="hidden" name="longitude" value={pin ? pin.lng.toFixed(6) : ""} />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {pin ? `Pin set at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.` : (hint ?? "Tap the map or use your location. Without a pin, delivery is estimated from the area and town.")}
      </p>
      {geoError ? <p className="text-xs font-medium text-destructive">{geoError}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}

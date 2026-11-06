"use client"

import { useState } from "react"
import Image from "next/image"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"

export function Gallery({ images, title }: { images: { id: string; url: string; alt: string | null }[]; title: string }) {
  const [active, setActive] = useState(0)
  const current = images[active]
  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border bg-muted">
        <ImageOff className="size-10 text-muted-foreground" aria-hidden />
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
        <Image src={current.url} alt={current.alt ?? title} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
      </div>
      {images.length > 1 ? (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={cn("relative block aspect-square w-full overflow-hidden rounded-md border-2", i === active ? "border-primary" : "border-transparent")}
              >
                <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

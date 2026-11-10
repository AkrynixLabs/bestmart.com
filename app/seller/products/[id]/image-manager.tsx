"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react"

import { FormMessage } from "@/components/forms/form-fields"
import { Button } from "@/components/ui/button"
import { initialFormState, type FormState } from "@/lib/actions/state"
import { resizeImage } from "@/lib/client/resize-image"

import { deleteProductImageAction, moveProductImageAction, uploadProductImageAction } from "../actions"

type Image = { id: string; url: string }

export function ImageManager({ productId, title, images, max }: { productId: string; title: string; images: Image[]; max: number }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState<FormState>(initialFormState)
  const [busy, startTransition] = useTransition()
  const remaining = max - images.length

  function run(action: typeof deleteProductImageAction, fields: Record<string, string>) {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.set(k, v)
    startTransition(async () => setMessage(await action(initialFormState, form)))
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files).slice(0, remaining)
    let last: FormState = initialFormState
    for (const [i, file] of list.entries()) {
      setUploading(`Uploading ${i + 1} of ${list.length}…`)
      const form = new FormData()
      form.set("productId", productId)
      try {
        const resized = await resizeImage(file, 1600)
        form.set("image", resized.file)
        form.set("width", String(resized.width))
        form.set("height", String(resized.height))
      } catch {
        // The browser couldn't read it (e.g. HEIC): send as-is; the server explains if it's not allowed.
        form.set("image", file)
      }
      last = await uploadProductImageAction(initialFormState, form)
      if (last.error) break
    }
    if (files.length > remaining && !last.error) last = { error: `Only ${max} photos are allowed; the extra ones were skipped.` }
    setMessage(last.error ? last : { success: list.length === 1 ? "Photo added." : `${list.length} photos added.` })
    setUploading(null)
    if (input.current) input.current.value = ""
    startTransition(() => router.refresh())
  }

  return (
    <div className="grid gap-3">
      <FormMessage state={message} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {images.map((image, index) => (
          <li key={image.id} className="group relative overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`${title}, photo ${index + 1}`} className="aspect-square w-full object-cover" />
            {index === 0 ? <span className="absolute left-1.5 top-1.5 rounded bg-brand-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">Main</span> : null}
            <div className="flex items-center justify-between gap-1 border-t bg-background p-1">
              <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy || index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => run(moveProductImageAction, { imageId: image.id, direction: "up" })}>
                <ArrowLeft className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy || index === images.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => run(moveProductImageAction, { imageId: image.id, direction: "down" })}>
                <ArrowRight className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" disabled={busy} aria-label={`Delete photo ${index + 1}`} onClick={() => run(deleteProductImageAction, { imageId: image.id })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
        {remaining > 0 ? (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center text-sm text-muted-foreground hover:bg-muted/50">
              {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
              <span>{uploading ?? "Add photos"}</span>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                className="sr-only"
                disabled={Boolean(uploading)}
                aria-label="Add product photos"
                onChange={(e) => void upload(e.currentTarget.files)}
              />
            </label>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

// Shrinks a photo in the browser before upload: phone photos are often
// 3-8 MB, far over the server's request limit and slow on mobile data.
// Output is always JPEG (every browser can encode it), EXIF rotation is
// applied, and metadata such as GPS location is dropped.

export type ResizedImage = { file: File; width: number; height: number }

export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is not available")
    // JPEG has no transparency: paint white behind transparent PNGs.
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (!blob) throw new Error("Could not encode the image")
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return { file: new File([blob], name, { type: "image/jpeg" }), width, height }
  } finally {
    bitmap.close()
  }
}

/** Replaces the file in an <input type="file"> with a resized copy (PDFs and non-images are left alone). */
export async function shrinkFileInput(input: HTMLInputElement, maxSide = 2000): Promise<void> {
  const file = input.files?.[0]
  if (!file || !file.type.startsWith("image/")) return
  try {
    const { file: resized } = await resizeImage(file, maxSide)
    if (resized.size >= file.size) return
    const transfer = new DataTransfer()
    transfer.items.add(resized)
    input.files = transfer.files
  } catch {
    // Unsupported format (e.g. HEIC in some browsers): keep the original;
    // the server rejects it with a clear message if it's too big or not allowed.
  }
}

// Upload rules shared by every file input. Types are decided by the file's
// leading bytes, never by its name or the browser's claimed type.

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export type ImageType = (typeof IMAGE_TYPES)[number]
export type UploadType = ImageType | "application/pdf"

/** Leaves room for form fields under the 4.5 MB request limit (next.config.ts). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export const EXTENSION: Record<UploadType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

export function sniffFileType(bytes: Uint8Array): UploadType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg"
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp"
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"
  return null
}

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const type = sniffFileType(bytes)
  return type && type !== "application/pdf" ? type : null
}

import { readFile } from "node:fs/promises"

import { allowDevFallbacks, env, isE2ETestMode } from "@/lib/env"
import { LOCAL_PUBLIC_ROOT, safeLocalPath } from "@/lib/storage"

// Serves locally stored public photos (.data/public) in development and
// e2e runs. With a public Blob store configured, photos are served by Blob
// and this route answers 404.

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const usingBlob = !isE2ETestMode() && Boolean(env().PUBLIC_BLOB_READ_WRITE_TOKEN)
  if (usingBlob || !allowDevFallbacks()) return new Response("Not found", { status: 404 })

  const key = (await params).key.join("/")
  const type = TYPES[key.split(".").pop()?.toLowerCase() ?? ""]
  if (!type) return new Response("Not found", { status: 404 })
  try {
    const body = await readFile(/*turbopackIgnore: true*/ safeLocalPath(key, LOCAL_PUBLIC_ROOT))
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}

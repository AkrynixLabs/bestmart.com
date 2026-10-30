import "server-only"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { get, put } from "@vercel/blob"

import { allowDevFallbacks, env, isE2ETestMode } from "@/lib/env"

// Private file storage (seller KYC documents). Files are never publicly
// reachable: they're read back only through routes that check permissions.
// Production uses a private Vercel Blob store; development without a Blob
// token falls back to .data/private/ on disk (git-ignored).

const LOCAL_ROOT = path.join(process.cwd(), ".data", "private")

function blobEnabled(): boolean {
  if (isE2ETestMode()) return false
  if (env().BLOB_READ_WRITE_TOKEN) return true
  if (!allowDevFallbacks()) throw new Error("BLOB_READ_WRITE_TOKEN is required in production for private uploads")
  return false
}

function safeLocalPath(key: string): string {
  const resolved = path.resolve(LOCAL_ROOT, key)
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key")
  return resolved
}

/** Stores a file privately and returns its storage key (a pathname). */
export async function putPrivate(key: string, data: Uint8Array, contentType: string): Promise<string> {
  if (blobEnabled()) {
    const result = await put(key, Buffer.from(data), { access: "private", contentType, addRandomSuffix: true })
    return result.pathname
  }
  const file = safeLocalPath(key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, data)
  await writeFile(`${file}.type`, contentType)
  return key
}

export async function getPrivate(key: string): Promise<{ body: ReadableStream | Uint8Array; contentType: string } | null> {
  if (blobEnabled()) {
    const result = await get(key, { access: "private" })
    if (!result || !("stream" in result) || !result.stream) return null
    return { body: result.stream, contentType: result.blob.contentType ?? "application/octet-stream" }
  }
  try {
    const file = safeLocalPath(key)
    const [body, contentType] = await Promise.all([readFile(file), readFile(`${file}.type`, "utf8")])
    return { body: new Uint8Array(body), contentType }
  } catch {
    return null
  }
}

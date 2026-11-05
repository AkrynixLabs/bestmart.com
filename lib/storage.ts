import "server-only"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { del, get, put } from "@vercel/blob"

import { allowDevFallbacks, env, isE2ETestMode } from "@/lib/env"

// File storage, two stores:
//  - private (seller KYC documents): never publicly reachable, read back only
//    through routes that check permissions.
//  - public (product and category photos): served directly by URL.
// Production uses Vercel Blob; development without tokens falls back to
// .data/private/ and .data/public/ on disk (git-ignored), the latter served
// at /media/* by app/media/[...key]/route.ts.

const LOCAL_ROOT = path.join(process.cwd(), ".data", "private")
export const LOCAL_PUBLIC_ROOT = path.join(process.cwd(), ".data", "public")

function blobEnabled(): boolean {
  if (isE2ETestMode()) return false
  if (env().BLOB_READ_WRITE_TOKEN) return true
  if (!allowDevFallbacks()) throw new Error("BLOB_READ_WRITE_TOKEN is required in production for private uploads")
  return false
}

function publicBlobToken(): string | null {
  if (isE2ETestMode()) return null
  const token = env().PUBLIC_BLOB_READ_WRITE_TOKEN
  if (token) return token
  if (!allowDevFallbacks()) throw new Error("PUBLIC_BLOB_READ_WRITE_TOKEN is required in production for photo uploads")
  return null
}

export function safeLocalPath(key: string, root = LOCAL_ROOT): string {
  const resolved = path.resolve(root, key)
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid storage key")
  return resolved
}

/** Stores a file privately and returns its storage key (a pathname). */
export async function putPrivate(key: string, data: Uint8Array, contentType: string): Promise<string> {
  if (blobEnabled()) {
    const result = await put(key, Buffer.from(data), { access: "private", contentType, addRandomSuffix: true })
    return result.pathname
  }
  const file = safeLocalPath(key)
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ file, data)
  await writeFile(/*turbopackIgnore: true*/ `${file}.type`, contentType)
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
    const [body, contentType] = await Promise.all([readFile(/*turbopackIgnore: true*/ file), readFile(/*turbopackIgnore: true*/ `${file}.type`, "utf8")])
    return { body: new Uint8Array(body), contentType }
  } catch {
    return null
  }
}

/** Stores a publicly readable file. Returns its URL and storage key. */
export async function putPublic(key: string, data: Uint8Array, contentType: string): Promise<{ url: string; key: string }> {
  const token = publicBlobToken()
  if (token) {
    const result = await put(key, Buffer.from(data), {
      access: "public",
      contentType,
      addRandomSuffix: true,
      token,
      // Keys are unique per upload, so the file at a URL never changes.
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    })
    return { url: result.url, key: result.pathname }
  }
  const file = safeLocalPath(key, LOCAL_PUBLIC_ROOT)
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ file, data)
  return { url: `/media/${key}`, key }
}

export async function deletePublic(key: string): Promise<void> {
  const token = publicBlobToken()
  if (token) {
    await del(key, { token })
    return
  }
  await rm(/*turbopackIgnore: true*/ safeLocalPath(key, LOCAL_PUBLIC_ROOT), { force: true })
}

"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it can't rely on globals.css or the site header.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en-GH">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center", color: "#0a1a3c" }}>
        <h1>Something went wrong</h1>
        <p>Please refresh the page. If it keeps happening, try again in a few minutes.</p>
      </body>
    </html>
  )
}

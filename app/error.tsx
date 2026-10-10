"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

import { Button } from "@/components/ui/button"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        Please try again. If it keeps happening, contact support
        {error.digest ? (
          <>
            {" "}
            and quote reference <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}

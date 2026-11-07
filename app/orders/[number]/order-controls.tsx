"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { FormMessage, SubmitButton } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"

import { cancelOrderAction } from "../actions"

/** "Reserved for 28:41", refreshing the page when time runs out. */
export function ReservationCountdown({ until }: { until: string }) {
  const router = useRouter()
  const end = new Date(until).getTime()
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()))
  useEffect(() => {
    const timer = setInterval(() => {
      const ms = Math.max(0, end - Date.now())
      setLeft(ms)
      if (ms === 0) {
        clearInterval(timer)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [end, router])
  const minutes = Math.floor(left / 60_000)
  const seconds = Math.floor((left % 60_000) / 1000)
  return (
    <span className="font-semibold tabular-nums" role="timer" aria-live="off">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  )
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(cancelOrderAction, initialFormState)
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <SubmitButton variant="outline" pendingText="Cancelling…">
          Cancel order
        </SubmitButton>
      </div>
    </form>
  )
}

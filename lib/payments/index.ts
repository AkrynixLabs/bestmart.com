import "server-only"

import { allowDevFallbacks, env, isE2ETestMode } from "@/lib/env"

import { fakeProvider } from "./fake"
import { createPaystack } from "./paystack"
import type { PaymentProvider } from "./types"

let paystack: PaymentProvider | null = null

/** Paystack when a key is configured; the local stand-in in development/e2e; an error in production without a key. */
export function paymentProvider(): PaymentProvider {
  if (isE2ETestMode()) return fakeProvider
  const key = env().PAYSTACK_SECRET_KEY
  if (key) return (paystack ??= createPaystack(key))
  if (allowDevFallbacks()) return fakeProvider
  throw new Error("PAYSTACK_SECRET_KEY is required in production")
}

export function usingFakePayments(): boolean {
  return isE2ETestMode() || (!env().PAYSTACK_SECRET_KEY && allowDevFallbacks())
}

export type { PaymentProvider, VerifiedTransaction } from "./types"

import "server-only"

import { logger } from "@/lib/logger"

import { signatureMatches } from "./signature"
import type { PaymentProvider, RefundResult, VerifiedTransaction } from "./types"

// Paystack REST API (https://paystack.com/docs/api). Amounts are in the
// currency's subunit, which for GHS is pesewas, matching our own storage.

const BASE = "https://api.paystack.co"

type PaystackEnvelope<T> = { status: boolean; message: string; data: T }

export function createPaystack(secretKey: string): PaymentProvider {
  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    const json = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null
    if (!res.ok || !json?.status) {
      logger.error("paystack request failed", { path, status: res.status, message: json?.message })
      throw new Error(`Paystack ${path} failed: ${json?.message ?? res.status}`)
    }
    return json.data
  }

  return {
    name: "paystack",

    async initialize(input) {
      const data = await call<{ authorization_url: string }>("/transaction/initialize", {
        method: "POST",
        body: {
          email: input.email,
          amount: input.amount,
          currency: "GHS",
          reference: input.reference,
          callback_url: input.callbackUrl,
          channels: ["mobile_money", "card"],
          metadata: input.metadata,
        },
      })
      return { authorizationUrl: data.authorization_url }
    },

    async verify(reference): Promise<VerifiedTransaction> {
      const d = await call<{
        status: string
        reference: string
        amount: number
        currency: string
        id: number
        channel: string | null
        fees: number | null
        paid_at: string | null
        gateway_response: string | null
      }>(`/transaction/verify/${encodeURIComponent(reference)}`)
      const status = d.status === "success" ? "success" : d.status === "failed" ? "failed" : d.status === "abandoned" ? "abandoned" : "pending"
      return {
        status,
        reference: d.reference,
        amount: d.amount,
        currency: d.currency,
        providerTransactionId: String(d.id),
        channel: d.channel,
        fee: typeof d.fees === "number" ? d.fees : null,
        paidAt: d.paid_at ? new Date(d.paid_at) : null,
        gatewayResponse: d.gateway_response,
      }
    },

    async refund({ reference, amount, note }): Promise<RefundResult> {
      const d = await call<{ id: number; status: string }>("/refund", { method: "POST", body: { transaction: reference, amount, merchant_note: note.slice(0, 200) } })
      return { providerRefundId: String(d.id), status: d.status === "processed" ? "processed" : d.status === "failed" ? "failed" : "pending" }
    },

    verifySignature(rawBody, signature) {
      return signatureMatches(rawBody, signature, secretKey)
    },
  }
}

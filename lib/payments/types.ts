// The contract between BestMart and a payment provider (Paystack today).
// Amounts are always integer pesewas.

export type InitializeInput = {
  reference: string
  amount: number
  email: string
  callbackUrl: string
  metadata: Record<string, string>
}

export type VerifiedTransaction = {
  status: "success" | "failed" | "abandoned" | "pending"
  reference: string
  amount: number
  currency: string
  providerTransactionId: string
  channel: string | null
  fee: number | null
  paidAt: Date | null
  gatewayResponse: string | null
}

export type RefundResult = { providerRefundId: string; status: "pending" | "processed" | "failed" }

export interface PaymentProvider {
  readonly name: string
  /** Starts a payment; returns the provider's hosted checkout URL. */
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string }>
  /** Asks the provider for the truth about a payment (never trust the browser). */
  verify(reference: string): Promise<VerifiedTransaction>
  /** Returns money to the buyer (whole or part of a transaction). */
  refund(input: { reference: string; amount: number; note: string }): Promise<RefundResult>
  /** Checks a webhook really came from the provider. */
  verifySignature(rawBody: string, signature: string | null): boolean
}

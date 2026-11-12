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

export type RecipientInput = {
  kind: "mobile_money" | "bank_account"
  /** Paystack bank code: "MTN" / "VOD" / "ATL" for MoMo, or a bank's code. */
  bankCode: string
  accountName: string
  accountNumber: string
}

export type TransferResult = { transferCode: string; status: "pending" | "success" | "failed"; failureReason?: string }

export type Bank = { name: string; code: string }

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
  /** Ghana banks that can receive transfers. */
  listBanks(): Promise<Bank[]>
  /** Registers a seller's payout account; returns the recipient code. */
  createRecipient(input: RecipientInput): Promise<string>
  /** Sends money from the platform balance to a recipient. */
  transfer(input: { amount: number; recipientCode: string; reference: string; reason: string }): Promise<TransferResult>
}

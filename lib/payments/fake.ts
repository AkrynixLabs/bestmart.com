import "server-only"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { FAKE_SECRET } from "./fake-secret"
import { signatureMatches } from "./signature"

export { FAKE_SECRET }
import type { PaymentProvider, VerifiedTransaction } from "./types"

// A local stand-in for Paystack, used in development without a key and in
// end-to-end tests. "Transactions" are JSON files in .data/fake-payments/;
// the checkout page is /dev/paystack/[reference], which posts a correctly
// signed webhook to our own endpoint, exactly like Paystack would.

const ROOT = path.join(process.cwd(), ".data", "fake-payments")

export type FakeTransaction = {
  reference: string
  amount: number
  email: string
  callbackUrl: string
  status: "pending" | "success" | "failed"
  id: number
  paidAt: string | null
  refunds: { id: number; amount: number }[]
}

function file(reference: string) {
  if (!/^[A-Za-z0-9-]{6,64}$/.test(reference)) throw new Error("Invalid reference")
  return path.join(ROOT, `${reference}.json`)
}

export async function readFake(reference: string): Promise<FakeTransaction | null> {
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ file(reference), "utf8")) as FakeTransaction
  } catch {
    return null
  }
}

export async function writeFake(tx: FakeTransaction) {
  await mkdir(/*turbopackIgnore: true*/ ROOT, { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ file(tx.reference), JSON.stringify(tx, null, 2))
}

export const fakeProvider: PaymentProvider = {
  name: "paystack",

  async initialize(input) {
    await writeFake({ reference: input.reference, amount: input.amount, email: input.email, callbackUrl: input.callbackUrl, status: "pending", id: Date.now(), paidAt: null, refunds: [] })
    return { authorizationUrl: `/dev/paystack/${input.reference}` }
  },

  async verify(reference): Promise<VerifiedTransaction> {
    const tx = await readFake(reference)
    if (!tx) throw new Error(`Unknown reference ${reference}`)
    return {
      status: tx.status === "pending" ? "pending" : tx.status,
      reference,
      amount: tx.amount,
      currency: "GHS",
      providerTransactionId: String(tx.id),
      channel: tx.status === "success" ? "mobile_money" : null,
      // Roughly Paystack Ghana's 1.95% local fee, for realistic reports.
      fee: tx.status === "success" ? Math.round(tx.amount * 0.0195) : null,
      paidAt: tx.paidAt ? new Date(tx.paidAt) : null,
      gatewayResponse: tx.status === "success" ? "Approved (test)" : tx.status === "failed" ? "Declined (test)" : null,
    }
  },

  async refund({ reference, amount }) {
    const tx = await readFake(reference)
    if (!tx || tx.status !== "success") throw new Error("Can't refund an unpaid test transaction")
    const refunded = tx.refunds.reduce((s, r) => s + r.amount, 0)
    if (refunded + amount > tx.amount) throw new Error("Refund exceeds the payment")
    const id = Date.now()
    tx.refunds.push({ id, amount })
    await writeFake(tx)
    return { providerRefundId: String(id), status: "processed" }
  },

  verifySignature(rawBody, signature) {
    return signatureMatches(rawBody, signature, FAKE_SECRET)
  },

  async listBanks() {
    return FAKE_BANKS
  },

  async createRecipient(input) {
    // Encodes the account number so transfer() can simulate failures.
    return `RCP_test_${input.bankCode}_${input.accountNumber}`
  },

  async transfer({ recipientCode, reference }) {
    // Test rule: accounts ending in 999 fail, like a closed account would.
    if (recipientCode.endsWith("999")) return { transferCode: `TRF_test_${reference}`, status: "failed", failureReason: "Account could not be credited (test)" }
    return { transferCode: `TRF_test_${reference}`, status: "success" }
  },
}

/** A few real Ghana bank names with made-up codes, for development. */
export const FAKE_BANKS = [
  { name: "GCB Bank Limited", code: "TEST-GCB" },
  { name: "Ecobank Ghana Limited", code: "TEST-ECO" },
  { name: "Fidelity Bank Ghana Limited", code: "TEST-FID" },
  { name: "Stanbic Bank Ghana Limited", code: "TEST-STB" },
  { name: "Absa Bank Ghana Limited", code: "TEST-ABS" },
]

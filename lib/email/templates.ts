import { appUrl, site } from "@/lib/site"

// Plain, table-free HTML that renders acceptably in every mail client, plus a
// text version. User-supplied values are escaped.

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5">${p}</p>`).join("")
  const button = action
    ? `<p style="margin:24px 0"><a href="${action.url}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#556079">Or paste this link into your browser:<br>${action.url}</p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0a1a3c">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <p style="font-size:20px;font-weight:800;margin:0 0 24px"><span style="color:#1d4ed8">Best</span><span style="color:#f97316">Mart</span></p>
    <div style="background:#fff;border-radius:12px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${button}
    </div>
    <p style="font-size:12px;color:#556079;margin:24px 0 0">${site.name} · ${site.tagline}</p>
  </div></body></html>`
}

function text(title: string, lines: string[], action?: { label: string; url: string }) {
  return [title, "", ...lines, ...(action ? ["", `${action.label}: ${action.url}`] : []), "", `${site.name}`].join("\n")
}

export function verifyEmailMessage(name: string, token: string) {
  const url = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`
  const title = "Confirm your email address"
  const lines = [`Hi ${name},`, `Welcome to ${site.name}! Confirm your email address to finish creating your account. This link expires in 24 hours.`]
  const action = { label: "Confirm email", url }
  return { subject: `Confirm your ${site.name} account`, html: layout(title, [lines[0]!, lines[1]!].map(escapeHtml), action), text: text(title, lines, action) }
}

export function accountExistsMessage(name: string) {
  const url = `${appUrl()}/login`
  const reset = `${appUrl()}/forgot-password`
  const title = "You already have an account"
  const lines = [
    `Hi ${name},`,
    `Someone (hopefully you) tried to create a ${site.name} account with this email address, but you already have one.`,
    `If you've forgotten your password, you can reset it at ${reset}. If this wasn't you, you can ignore this email.`,
  ]
  const action = { label: "Sign in", url }
  return { subject: `Your ${site.name} account`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function resetPasswordMessage(name: string, token: string) {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const title = "Reset your password"
  const lines = [`Hi ${name},`, "We received a request to reset your password. This link expires in 1 hour and can only be used once.", "If you didn't ask for this, ignore this email; your password won't change."]
  const action = { label: "Choose a new password", url }
  return { subject: `Reset your ${site.name} password`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function passwordChangedMessage(name: string) {
  const title = "Your password was changed"
  const lines = [`Hi ${name},`, `The password for your ${site.name} account was just changed. If this wasn't you, reset your password straight away and contact support.`]
  const action = { label: "Reset password", url: `${appUrl()}/forgot-password` }
  return { subject: `Your ${site.name} password was changed`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function applicationReceivedMessage(name: string, storeName: string) {
  const title = "We received your seller application"
  const lines = [`Hi ${name},`, `Thanks for applying to sell on ${site.name} as "${storeName}". Our team will review your details and Ghana Card, usually within 2 working days, and email you the outcome.`]
  const action = { label: "Check your application", url: `${appUrl()}/sell/apply` }
  return { subject: `Seller application received: ${storeName}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function applicationApprovedMessage(name: string, storeName: string) {
  const title = "You're approved to sell on BestMart"
  const lines = [`Hi ${name},`, `Good news: "${storeName}" is approved. You can now open your seller dashboard.`]
  const action = { label: "Open seller dashboard", url: `${appUrl()}/seller` }
  return { subject: `Approved: ${storeName} can now sell on ${site.name}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function applicationRejectedMessage(name: string, storeName: string, reason: string) {
  const title = "About your seller application"
  const lines = [`Hi ${name},`, `We couldn't approve the application for "${storeName}" this time.`, `Reason: ${reason}`, "You're welcome to apply again once this is resolved."]
  const action = { label: "Apply again", url: `${appUrl()}/sell/apply` }
  return { subject: `Your seller application for ${storeName}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function categorySuggestionAcceptedMessage(name: string, suggested: string, categoryLabel: string) {
  const title = "Your category suggestion was added"
  const lines = [`Hi ${name},`, `Thanks for suggesting "${suggested}". It's now available as ${categoryLabel}, so you can list products there.`]
  const action = { label: "Add a product", url: `${appUrl()}/seller/products/new` }
  return { subject: `New category: ${categoryLabel}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function categorySuggestionDeclinedMessage(name: string, suggested: string, response: string | null) {
  const title = "About your category suggestion"
  const lines = [`Hi ${name},`, `We haven't added "${suggested}" as a category this time.`, ...(response ? [`Note from our team: ${response}`] : [])]
  const action = { label: "Browse categories", url: `${appUrl()}/seller/products/new` }
  return { subject: `Your category suggestion: ${suggested}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function productBlockedMessage(name: string, productTitle: string, reason: string, productId: string) {
  const title = "A listing was taken down"
  const lines = [`Hi ${name},`, `Your listing "${productTitle}" has been hidden from shoppers.`, `Reason: ${reason}`, "Reply to this email if you think this is a mistake or once you've fixed it."]
  const action = { label: "View the listing", url: `${appUrl()}/seller/products/${productId}` }
  return { subject: `Listing hidden: ${productTitle}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

const ghs = (pesewas: number) => `GH₵${(pesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function paymentReceivedMessage(name: string, orderNumber: string, total: number) {
  const title = "Payment received"
  const lines = [`Hi ${name},`, `We've received ${ghs(total)} for order ${orderNumber}. The seller has been told to prepare it.`, `Your money stays with ${site.name} until you confirm the order arrived.`]
  const action = { label: "View your order", url: `${appUrl()}/orders/${orderNumber}` }
  return { subject: `Payment received for order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function newOrderMessage(name: string, storeName: string, orderNumber: string, itemsTotal: number, itemCount: number) {
  const title = "You have a new paid order"
  const lines = [`Hi ${name},`, `${storeName} has a new paid order (${orderNumber}): ${itemCount} item(s), ${ghs(itemsTotal)} before commission.`, "Please prepare it for delivery."]
  const action = { label: "Open your seller dashboard", url: `${appUrl()}/seller` }
  return { subject: `New order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function refundIssuedMessage(name: string, orderNumber: string, amount: number, reason: string) {
  const title = "Refund on its way"
  const lines = [`Hi ${name},`, `We've refunded ${ghs(amount)} for order ${orderNumber}.`, `Reason: ${reason}`, "It goes back to the Mobile Money wallet or card you paid with; banks and networks can take a few days to show it."]
  const action = { label: "View your order", url: `${appUrl()}/orders/${orderNumber}` }
  return { subject: `Refund for order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function shippedMessage(name: string, orderNumber: string, storeName: string, how: string) {
  const title = "Your order is on its way"
  const lines = [`Hi ${name},`, `${storeName} has sent your items from order ${orderNumber}.`, how, "When it arrives, confirm it on your order page. If something's wrong, report it there instead."]
  const action = { label: "View your order", url: `${appUrl()}/orders/${orderNumber}` }
  return { subject: `On its way: order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function deliveredMessage(name: string, storeName: string, orderNumber: string, auto: boolean, availableOn: string) {
  const title = "Delivery confirmed"
  const lines = [
    `Hi ${name},`,
    auto ? `Order ${orderNumber} for ${storeName} was confirmed automatically (the buyer didn't report a problem in time).` : `The buyer confirmed they received order ${orderNumber} from ${storeName}.`,
    `Your earnings for it become available on ${availableOn}, if no problem is reported before then.`,
  ]
  const action = { label: "View earnings", url: `${appUrl()}/seller/earnings` }
  return { subject: `Delivered: order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function overdueShipmentMessage(name: string, orderNumber: string, storeName: string) {
  const title = "Your order hasn't shipped yet"
  const lines = [`Hi ${name},`, `${storeName} hasn't sent your items from order ${orderNumber} within the time allowed.`, "You can keep waiting, or cancel that part of the order for a full refund from your order page."]
  const action = { label: "View your order", url: `${appUrl()}/orders/${orderNumber}` }
  return { subject: `Not shipped yet: order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function disputeOpenedMessage(name: string, storeName: string, orderNumber: string, reason: string, subOrderId: string) {
  const title = "A buyer reported a problem"
  const lines = [`Hi ${name},`, `The buyer of order ${orderNumber} (${storeName}) reported: ${reason}.`, "Your earnings for this order are on hold until our team resolves it. You can add your side of the story on the order page."]
  const action = { label: "Respond", url: `${appUrl()}/seller/orders/${subOrderId}` }
  return { subject: `Problem reported: order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function disputeResolvedMessage(name: string, orderNumber: string, outcome: string, note: string | null, url: string) {
  const title = "Your reported problem has been resolved"
  const lines = [`Hi ${name},`, `About order ${orderNumber}: ${outcome}`, ...(note ? [`Note from our team: ${note}`] : [])]
  const action = { label: "View the order", url }
  return { subject: `Resolved: order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

export function sellerCancelledMessage(name: string, orderNumber: string, storeName: string, reason: string) {
  const title = "Part of your order was cancelled"
  const lines = [`Hi ${name},`, `${storeName} couldn't fulfil its part of order ${orderNumber}.`, `Reason: ${reason}`, "You'll get a full refund for that part (a separate email confirms it)."]
  const action = { label: "View your order", url: `${appUrl()}/orders/${orderNumber}` }
  return { subject: `Cancelled by the seller: order ${orderNumber}`, html: layout(title, lines.map(escapeHtml), action), text: text(title, lines, action) }
}

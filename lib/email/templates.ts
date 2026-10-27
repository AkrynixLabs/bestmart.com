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

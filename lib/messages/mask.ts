// Hides contact details in buyer–seller messages until the buyer has a paid
// order with that store, so deals stay on BestMart (and keep buyer
// protection). Pure and unit-tested; deliberately errs on the side of hiding.

export const HIDDEN = "[contact hidden]"

const PATTERNS: RegExp[] = [
  // Emails, including "name at gmail dot com" spellings.
  /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\bat\b)\s*[A-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[A-Z]{2,}/gi,
  // Links and bare domains.
  /\b(?:https?:\/\/|www\.)\S+/gi,
  /\b[A-Z0-9-]+\.(?:com|net|org|gh|io|me|co|link|ly|app|shop)(?:\/\S*)?\b/gi,
  // WhatsApp / Telegram handles and short links.
  /\b(?:wa\.me|t\.me)\/\S+/gi,
  // Phone numbers: 9+ digits, allowing spaces, dots, dashes, brackets and a leading +.
  /\+?\(?\d(?:[\s().-]*\d){8,}/g,
]

/** The message with contact details replaced, and whether anything was hidden. */
export function maskContacts(text: string): { text: string; masked: boolean } {
  let out = text
  for (const pattern of PATTERNS) out = out.replace(pattern, HIDDEN)
  return { text: out, masked: out !== text }
}

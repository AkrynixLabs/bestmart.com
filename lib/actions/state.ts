import type { FieldErrors } from "@/lib/validation/common"

/**
 * What every form Server Action returns. Expected failures come back as data
 * (production strips thrown error messages). `values` echoes what was typed
 * so the form can re-fill after a validation error (never passwords).
 */
export type FormState = {
  error?: string
  fieldErrors?: FieldErrors
  success?: string
  values?: Record<string, string>
}

export const initialFormState: FormState = {}

const NEVER_ECHO = /pass|token|card|file/i

export function echoValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !NEVER_ECHO.test(key)) out[key] = value
  }
  return out
}

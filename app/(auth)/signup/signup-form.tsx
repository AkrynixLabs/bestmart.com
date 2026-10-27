"use client"

import { useActionState } from "react"
import Link from "next/link"

import { CheckboxField, FormMessage, SubmitButton, TextField } from "@/components/forms/form-fields"
import { initialFormState } from "@/lib/actions/state"
import { PASSWORD_MIN } from "@/lib/validation/auth"

import { signUpAction } from "../actions"

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialFormState)
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField name="name" label="Full name" autoComplete="name" required state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <TextField name="phone" label="Phone number (optional)" type="tel" autoComplete="tel" placeholder="024 123 4567" state={state} hint="For delivery updates. You can add it later." />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        state={state}
        hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}
      />
      <TextField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" required state={state} />
      <CheckboxField
        name="acceptTerms"
        state={state}
        label={
          <>
            I agree to the{" "}
            <Link href="/terms" className="text-primary underline" target="_blank">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary underline" target="_blank">
              Privacy Policy
            </Link>
            .
          </>
        }
      />
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  )
}

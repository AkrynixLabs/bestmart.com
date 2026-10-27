"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { FormState } from "@/lib/actions/state"
import { cn } from "@/lib/utils"

type BaseProps = {
  name: string
  label: string
  state?: FormState
  hint?: React.ReactNode
  className?: string
}

function useFieldIds(name: string) {
  const id = React.useId()
  return { inputId: `${id}-${name}`, errorId: `${id}-${name}-error`, hintId: `${id}-${name}-hint` }
}

function FieldShell({
  label,
  inputId,
  error,
  errorId,
  hint,
  hintId,
  className,
  children,
}: {
  label: string
  inputId: string
  error?: string
  errorId: string
  hint?: React.ReactNode
  hintId: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({
  name,
  label,
  state,
  hint,
  className,
  defaultValue,
  ...inputProps
}: BaseProps & Omit<React.ComponentProps<"input">, "name">) {
  const { inputId, errorId, hintId } = useFieldIds(name)
  const error = state?.fieldErrors?.[name]
  const value = inputProps.type === "password" || inputProps.type === "file" ? undefined : (state?.values?.[name] ?? defaultValue)
  return (
    <FieldShell label={label} inputId={inputId} error={error} errorId={errorId} hint={hint} hintId={hintId} className={className}>
      <Input
        id={inputId}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="h-10"
        {...inputProps}
      />
    </FieldShell>
  )
}

export function TextAreaField({
  name,
  label,
  state,
  hint,
  className,
  defaultValue,
  ...props
}: BaseProps & Omit<React.ComponentProps<"textarea">, "name">) {
  const { inputId, errorId, hintId } = useFieldIds(name)
  const error = state?.fieldErrors?.[name]
  return (
    <FieldShell label={label} inputId={inputId} error={error} errorId={errorId} hint={hint} hintId={hintId} className={className}>
      <Textarea
        id={inputId}
        name={name}
        defaultValue={state?.values?.[name] ?? defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      />
    </FieldShell>
  )
}

export function SelectField({
  name,
  label,
  state,
  hint,
  className,
  options,
  placeholder,
  defaultValue,
  ...props
}: BaseProps & { options: readonly (readonly [string, string])[]; placeholder?: string } & Omit<React.ComponentProps<"select">, "name">) {
  const { inputId, errorId, hintId } = useFieldIds(name)
  const error = state?.fieldErrors?.[name]
  return (
    <FieldShell label={label} inputId={inputId} error={error} errorId={errorId} hint={hint} hintId={hintId} className={className}>
      <select
        id={inputId}
        name={name}
        {...(props.value === undefined ? { defaultValue: state?.values?.[name] ?? defaultValue ?? "" } : {})}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export function CheckboxField({
  name,
  label,
  state,
  defaultChecked,
}: {
  name: string
  label: React.ReactNode
  state?: FormState
  defaultChecked?: boolean
}) {
  const id = React.useId()
  const error = state?.fieldErrors?.[name]
  const checked = state?.values ? state.values[name] === "on" : defaultChecked
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 rounded border-input accent-[var(--brand-blue)]"
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function SubmitButton({ children, pendingText, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? (pendingText ?? "Please wait…") : children}
    </Button>
  )
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{state.error}</p>
      </div>
    )
  }
  if (state.success) {
    return (
      <div role="status" className="flex gap-2 rounded-md border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{state.success}</p>
      </div>
    )
  }
  return null
}

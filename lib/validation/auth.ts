import { z } from "zod"

import { email, ghanaPhone, requiredText } from "./common"

export const PASSWORD_MIN = 8

export const password = z
  .string({ error: "Password is required" })
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128, "Use 128 characters or fewer")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include at least one letter and one number")

export const signUpSchema = z
  .object({
    name: requiredText("Full name", 100),
    email,
    phone: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined)
      .pipe(ghanaPhone.optional()),
    password,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", { error: "You need to accept the terms to create an account" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((d) => d.password.toLowerCase() !== d.email, { path: ["password"], message: "Don't use your email as your password" })

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })

export const profileSchema = z.object({
  name: requiredText("Full name", 100),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(ghanaPhone.optional()),
})

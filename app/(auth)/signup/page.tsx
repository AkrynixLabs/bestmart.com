import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/layout/auth-card"

import { SignUpForm } from "./signup-form"

export const metadata: Metadata = { title: "Create an account" }

export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Shop from verified sellers with buyer protection on every order."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  )
}

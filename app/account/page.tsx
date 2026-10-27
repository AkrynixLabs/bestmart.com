import type { Metadata } from "next"

import { requireUser } from "@/lib/auth/session"

import { PasswordForm, ProfileForm } from "./account-forms"

export const metadata: Metadata = { title: "My account" }

export default async function AccountPage() {
  const user = await requireUser("/account")
  return (
    <div className="grid gap-8">
      <section className="rounded-xl border bg-card p-6">
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email: <span className="font-medium text-foreground">{user.email}</span>
        </p>
        <div className="mt-6 max-w-md">
          <ProfileForm name={user.name} phone={user.phone ?? ""} />
        </div>
      </section>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-xl font-bold">{user.hasPassword ? "Change password" : "Set a password"}</h2>
        {!user.hasPassword ? <p className="mt-1 text-sm text-muted-foreground">You sign in with Google. Set a password to also sign in with your email.</p> : null}
        <div className="mt-6 max-w-md">
          <PasswordForm hasPassword={user.hasPassword} />
        </div>
      </section>
    </div>
  )
}

"use client"

import Link from "next/link"
import { SessionProvider, signOut, useSession } from "next-auth/react"
import { ChevronDown, LogOut, MapPin, ShieldCheck, Store, User, Package, Heart, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Client-side so storefront pages stay static (reading the session on the
// server would make every page dynamic). The role shown here only decides
// which links appear; the pages themselves check permissions on the server.
export function UserMenu() {
  return (
    <SessionProvider>
      <UserMenuInner />
    </SessionProvider>
  )
}

function UserMenuInner() {
  const { data, status } = useSession()

  if (status === "loading") return <div className="h-9 w-20 animate-pulse rounded-md bg-muted" aria-hidden />

  if (!data?.user) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
    )
  }

  const { name, email, role } = data.user
  const firstName = (name ?? email ?? "Account").split(" ")[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <User aria-hidden />
          <span className="max-w-24 truncate">{firstName}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          <span className="block font-semibold">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User aria-hidden /> My account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/orders">
            <Package aria-hidden /> Orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/messages">
            <MessageSquare aria-hidden /> Messages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved">
            <Heart aria-hidden /> Saved
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/addresses">
            <MapPin aria-hidden /> Addresses
          </Link>
        </DropdownMenuItem>
        {role === "seller" ? (
          <DropdownMenuItem asChild>
            <Link href="/seller">
              <Store aria-hidden /> Seller dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        {role === "ops_admin" || role === "super_admin" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck aria-hidden /> Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ redirectTo: "/" })}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

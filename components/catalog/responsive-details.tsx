"use client"

import { useEffect, useRef } from "react"

/** A <details> that's always open on wide screens (sidebar) and collapsible on phones. */
export function ResponsiveDetails({ children, className, defaultOpen }: { children: React.ReactNode; className?: string; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const sync = () => {
      if (query.matches && ref.current) ref.current.open = true
    }
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return (
    <details ref={ref} className={className} open={defaultOpen}>
      {children}
    </details>
  )
}

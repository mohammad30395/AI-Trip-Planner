"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"

import { NavLinks, type HeaderNavItem } from "@/components/navigation/nav-links"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MobileNavProps = {
  items: HeaderNavItem[]
  actions: ReactNode
  navLabel: string
  className?: string
}

function MobileNav({ items, actions, navLabel, className }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const closeMenu = () => setOpen(false)

    window.addEventListener("ai-trip-planner:close-mobile-nav", closeMenu)

    return () => {
      window.removeEventListener("ai-trip-planner:close-mobile-nav", closeMenu)
    }
  }, [])

  return (
    <div className={cn("relative lg:hidden", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation-menu"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </Button>

      {open ? (
        <div
          id="mobile-navigation-menu"
          className="absolute right-0 top-full z-[1110] mt-3 w-[min(calc(100vw-2rem),22rem)] rounded-[var(--app-panel-radius)] border bg-background p-3 shadow-[var(--app-shadow-elevated)]"
        >
          <nav className="grid gap-1" aria-label={navLabel}>
            <NavLinks
              items={items}
              orientation="mobile"
              onNavigate={() => setOpen(false)}
            />
          </nav>
          <div className="mt-3 border-t pt-3">{actions}</div>
        </div>
      ) : null}
    </div>
  )
}

export { MobileNav }

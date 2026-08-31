"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type HeaderNavItem = {
  href: string
  label: string
}

type NavLinksProps = {
  items: HeaderNavItem[]
  orientation?: "desktop" | "mobile"
  onNavigate?: () => void
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({
  items,
  orientation = "desktop",
  onNavigate,
}: NavLinksProps) {
  const pathname = usePathname()

  return (
    <>
      {items.map((item) => {
        const active = isActivePath(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "app-focus-ring rounded-[var(--app-pill-radius)] font-medium text-muted-foreground transition-colors hover:bg-soft-surface hover:text-foreground",
              active && "bg-accent text-accent-foreground",
              orientation === "desktop" && "px-4 py-2 text-sm",
              orientation === "mobile" &&
                "block w-full rounded-[var(--app-control-radius)] px-4 py-3 text-base"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

export { NavLinks, type HeaderNavItem }

"use client"

import { Show, UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuthControlsProps = {
  layout?: "desktop" | "mobile"
}

function closeMobileNav() {
  window.dispatchEvent(new CustomEvent("ai-trip-planner:close-mobile-nav"))
}

function AuthControls({ layout = "desktop" }: AuthControlsProps) {
  const pathname = usePathname()
  const signedInAction = pathname.startsWith("/create-trip")
    ? { href: "/my-trips", label: "My Trips" }
    : { href: "/create-trip", label: "Create New trip" }
  const isMobile = layout === "mobile"

  return (
    <div
      className={cn(
        "shrink-0 gap-2",
        isMobile ? "grid" : "flex items-center"
      )}
    >
      <Show when="signed-out">
        <Link
          href="/sign-in"
          onClick={isMobile ? closeMobileNav : undefined}
          className={cn(
            buttonVariants({ variant: isMobile ? "outline" : "ghost" }),
            isMobile && "w-full justify-center"
          )}
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          onClick={isMobile ? closeMobileNav : undefined}
          className={cn(
            buttonVariants({ size: "lg" }),
            isMobile && "w-full justify-center"
          )}
        >
          Get Started
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href={signedInAction.href}
          onClick={isMobile ? closeMobileNav : undefined}
          className={cn(
            buttonVariants({ size: "lg" }),
            isMobile && "w-full justify-center"
          )}
        >
          {signedInAction.label}
        </Link>
        <div className={cn(isMobile && "flex justify-center pt-1")}>
          <UserButton />
        </div>
      </Show>
    </div>
  )
}

export { AuthControls }

import Link from "next/link"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
}

function BrandLogo({ className }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "app-focus-ring inline-flex min-w-0 items-center gap-2.5 rounded-[var(--app-control-radius)] p-1",
        className
      )}
      aria-label="AI Trip Planner home"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--app-control-radius)] text-primary"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 40 40"
          className="size-8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="20" cy="20" r="4.25" fill="currentColor" />
          <path
            d="M20 5.5v6.25M20 28.25v6.25M5.5 20h6.25M28.25 20h6.25M9.75 9.75l4.5 4.5M25.75 25.75l4.5 4.5M30.25 9.75l-4.5 4.5M14.25 25.75l-4.5 4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M14.5 22.8c4.25 3.2 8.25 2.9 11.9-.9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.75"
          />
        </svg>
      </span>
      <span className="truncate font-heading text-lg leading-none font-bold text-foreground sm:text-xl">
        AI Trip Planner
      </span>
    </Link>
  )
}

export { BrandLogo }

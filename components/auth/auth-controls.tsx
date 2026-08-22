import { Show, UserButton } from "@clerk/nextjs"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <Link
          href="/sign-in"
          className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
        >
          Sign in
        </Link>
        <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
          Create Trip
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href="/create-trip"
          className={cn(buttonVariants({ size: "lg" }), "hidden sm:inline-flex")}
        >
          Create Trip
        </Link>
        <UserButton />
      </Show>
    </div>
  )
}

export { AuthControls }

"use client"

import type { ReactNode } from "react"
import { useAuth } from "@clerk/nextjs"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"

import { UserProfileSync } from "@/components/auth/user-profile-sync"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL")
}

const convex = new ConvexReactClient(convexUrl)

function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserProfileSync />
      {children}
    </ConvexProviderWithClerk>
  )
}

export { ConvexClientProvider }

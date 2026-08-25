"use client"

import { useEffect, useMemo, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { useConvexAuth, useMutation } from "convex/react"

import { api } from "@/convex/_generated/api"

function UserProfileSync() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } =
    useConvexAuth()
  const upsertCurrentUser = useMutation(api.users.upsertCurrentUserFromIdentity)
  const lastSyncKeyRef = useRef<string | null>(null)

  const displayName = useMemo(() => {
    return user?.fullName?.trim() || user?.username?.trim() || undefined
  }, [user?.fullName, user?.username])

  useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      isConvexLoading ||
      !isConvexAuthenticated ||
      user === undefined
    ) {
      lastSyncKeyRef.current = null
      return
    }

    const syncKey = `${user.id}:${displayName ?? ""}`

    if (lastSyncKeyRef.current === syncKey) {
      return
    }

    lastSyncKeyRef.current = syncKey

    void upsertCurrentUser(
      displayName !== undefined ? { displayName } : {}
    ).catch(() => {
      lastSyncKeyRef.current = null
    })
  }, [
    displayName,
    isConvexAuthenticated,
    isConvexLoading,
    isLoaded,
    isSignedIn,
    upsertCurrentUser,
    user,
  ])

  return null
}

export { UserProfileSync }

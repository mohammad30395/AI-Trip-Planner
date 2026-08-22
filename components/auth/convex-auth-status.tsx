"use client"

import {
  Authenticated,
  AuthLoading,
  AuthRefreshing,
  Unauthenticated,
  useQuery,
} from "convex/react"

import { api } from "@/convex/_generated/api"

function ConvexAuthStatus() {
  return (
    <>
      <AuthLoading>
        <p className="app-muted leading-7">Checking Convex authentication...</p>
      </AuthLoading>
      <AuthRefreshing>
        <p className="app-muted leading-7">Refreshing Convex authentication...</p>
      </AuthRefreshing>
      <Unauthenticated>
        <p className="app-muted leading-7">
          Convex has not verified an authenticated Clerk session yet.
        </p>
      </Unauthenticated>
      <Authenticated>
        <ConvexIdentitySummary />
      </Authenticated>
    </>
  )
}

function ConvexIdentitySummary() {
  const identity = useQuery(api.auth.whoAmI)

  if (identity === undefined) {
    return <p className="app-muted leading-7">Loading Convex identity...</p>
  }

  if (identity === null) {
    return (
      <p className="app-muted leading-7">
        Convex returned no identity for this request.
      </p>
    )
  }

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Convex identity</dt>
        <dd className="font-medium">
          {identity.isAuthenticated ? "Verified" : "Missing"}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Email verification</dt>
        <dd className="font-medium">
          {identity.emailVerified ? "Verified" : "Not reported"}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Issuer claim</dt>
        <dd className="font-medium">
          {identity.hasIssuer ? "Present" : "Missing"}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Subject claim</dt>
        <dd className="font-medium">
          {identity.hasSubject ? "Present" : "Missing"}
        </dd>
      </div>
    </dl>
  )
}

export { ConvexAuthStatus }

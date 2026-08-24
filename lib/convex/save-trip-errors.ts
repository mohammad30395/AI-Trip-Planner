import {
  createUserSafeError,
  formatUserSafeErrorMessage,
} from "@/lib/errors/user-safe-error"

type ConvexAuthReadiness = {
  isLoading: boolean
  isAuthenticated: boolean
}

type ClerkConvexTokenStatus = "available" | "missing" | "unknown"

function getSaveTripReadinessError(auth: ConvexAuthReadiness) {
  if (auth.isLoading) {
    return formatUserSafeErrorMessage(
      createUserSafeError({
        code: "convex_unavailable",
        title: "Save not ready",
        message:
          "Convex authentication is still loading. Try saving again in a moment without regenerating the itinerary.",
        retry: "same_stage",
      })
    )
  }

  if (!auth.isAuthenticated) {
    return formatConvexAuthFailureMessage()
  }

  return null
}

function getConvexTokenReadinessError(status: ClerkConvexTokenStatus) {
  if (status === "available") {
    return null
  }

  if (status === "missing") {
    return formatUserSafeErrorMessage(
      createUserSafeError({
        code: "auth_required",
        title: "Save needs Clerk Convex token",
        message:
          "Clerk is signed in, but it could not issue the `convex` token. Enable Clerk's Convex integration or JWT template named `convex`, then sign out and sign in again.",
        retry: "sign_in",
      })
    )
  }

  return formatConvexAuthFailureMessage()
}

function formatSaveTripMutationError(error: unknown) {
  const message = getSafeErrorText(error)
  const normalized = message.toLowerCase()

  if (
    normalized.includes("unauthenticated") ||
    normalized.includes("not authenticated") ||
    normalized.includes("no auth provider") ||
    normalized.includes("getuseridentity")
  ) {
    return formatConvexAuthFailureMessage()
  }

  if (
    normalized.includes("could not find public function") ||
    normalized.includes("functionnotfound") ||
    normalized.includes("not found: trips:savegeneratedtrip")
  ) {
    return formatUserSafeErrorMessage(
      createUserSafeError({
        code: "convex_unavailable",
        title: "Save unavailable",
        message:
          "The configured Convex deployment does not have the latest trip save function. Run `npx convex dev` locally or redeploy Convex for production, then retry saving.",
        retry: "same_stage",
      })
    )
  }

  if (
    normalized.includes("validation") ||
    normalized.includes("validator") ||
    normalized.includes("argument")
  ) {
    return formatUserSafeErrorMessage(
      createUserSafeError({
        code: "save_failed",
        title: "Save failed",
        message:
          "The generated itinerary did not match the database save contract. It remains on this page; retry saving after refreshing the app code.",
        retry: "same_stage",
      })
    )
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("websocket") ||
    normalized.includes("convex deployment")
  ) {
    return formatUserSafeErrorMessage(
      createUserSafeError({
        code: "convex_unavailable",
        title: "Save unavailable",
        message:
          "The app could not reach Convex. Confirm `NEXT_PUBLIC_CONVEX_URL` points to the active deployment and retry saving without regenerating the itinerary.",
        retry: "same_stage",
      })
    )
  }

  return formatUserSafeErrorMessage(
    createUserSafeError({
      code: "save_failed",
      title: "Save failed",
      message:
        "Your generated itinerary is still on this page. Retry saving without regenerating it.",
      retry: "same_stage",
    })
  )
}

function formatConvexAuthFailureMessage() {
  return formatUserSafeErrorMessage(
    createUserSafeError({
      code: "auth_required",
      title: "Save needs Convex auth",
      message:
        "Clerk sign-in succeeded, but Convex could not verify the Clerk token. Enable Clerk's Convex integration/JWT template named `convex`, set `CLERK_JWT_ISSUER_DOMAIN` on the active Convex deployment, sync with `npx convex dev` or `npx convex deploy`, then retry saving.",
      retry: "same_stage",
    })
  )
}

function getSafeErrorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  if (typeof error === "string") {
    return error
  }

  return "UnknownError"
}

export {
  formatSaveTripMutationError,
  getConvexTokenReadinessError,
  getSaveTripReadinessError,
}

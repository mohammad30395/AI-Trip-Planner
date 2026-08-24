export type UserSafeErrorCode =
  | "auth_required"
  | "billing_unavailable"
  | "configuration_error"
  | "convex_unavailable"
  | "map_unavailable"
  | "model_output_invalid"
  | "network_unavailable"
  | "place_lookup_empty"
  | "place_lookup_failed"
  | "quota_exceeded"
  | "request_cancelled"
  | "save_failed"
  | "unauthorized"
  | "unknown"

export type UserSafeError = {
  code: UserSafeErrorCode
  title: string
  message: string
  retry: "same_stage" | "sign_in" | "pricing" | "none"
  diagnostic?: {
    source: string
    reason?: string
  }
}

function createUserSafeError(error: UserSafeError): UserSafeError {
  return error
}

function formatUserSafeErrorMessage(error: UserSafeError) {
  return `${error.title}: ${error.message}`
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
}

function toSafeDiagnosticReason(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError"
}

export {
  createUserSafeError,
  formatUserSafeErrorMessage,
  isAbortError,
  toSafeDiagnosticReason,
}

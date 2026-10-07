import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  checkGroqModelAvailability,
  GROQ_SMOKE_TIMEOUT_MS,
  runGroqConversationSmoke,
  runGroqStrictCapabilitySmoke,
  type GroqCallResult,
} from "@/lib/ai/groq"

export const runtime = "nodejs"

type SmokeStage =
  | "model_availability"
  | "strict_capability"
  | "existing_schema"

export async function GET() {
  await auth.protect()

  const availability = await checkGroqModelAvailability(
    AbortSignal.timeout(GROQ_SMOKE_TIMEOUT_MS)
  )

  if (!availability.ok) {
    return groqSmokeError("model_availability", availability)
  }

  const strictCapability = await runGroqStrictCapabilitySmoke(
    AbortSignal.timeout(GROQ_SMOKE_TIMEOUT_MS)
  )

  if (!strictCapability.ok) {
    return groqSmokeError("strict_capability", strictCapability)
  }

  const existingSchema = await runGroqConversationSmoke(
    AbortSignal.timeout(GROQ_SMOKE_TIMEOUT_MS)
  )

  if (!existingSchema.ok) {
    return groqSmokeError("existing_schema", existingSchema)
  }

  return NextResponse.json({
    ok: true,
    provider: "groq",
    modelConfigured: true,
    modelAccessible: availability.data.accessible,
    existingSchemaTest: {
      ok: true,
      validated: true,
      selector: existingSchema.data.response.nextUISelector,
    },
    strictCapabilityTest: {
      ok: true,
      validated: strictCapability.data.validated,
    },
  })
}

function groqSmokeError(
  stage: SmokeStage,
  failure: Extract<GroqCallResult<unknown>, { ok: false }>
) {
  const status =
    failure.code === "configuration"
      ? 500
      : failure.code === "rate_limited"
        ? 429
        : failure.code === "provider_timeout"
          ? 504
          : 502

  return NextResponse.json(
    {
      ok: false,
      provider: "groq",
      stage,
      code: failure.code,
      error:
        failure.code === "rate_limited"
          ? "GROQ_RATE_LIMIT_BLOCKED"
          : "Groq smoke test failed.",
      ...(failure.missingVariables !== undefined
        ? { missingVariables: failure.missingVariables }
        : {}),
      ...(failure.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: failure.retryAfterSeconds }
        : {}),
    },
    { status }
  )
}

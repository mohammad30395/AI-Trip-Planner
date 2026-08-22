import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  OpenRouterConfigurationError,
  OPENROUTER_TIMEOUT_MS,
  runOpenRouterSmokeCall,
} from "@/lib/ai/openrouter"

export const runtime = "nodejs"

export async function GET() {
  await auth.protect()

  try {
    const signal = AbortSignal.timeout(OPENROUTER_TIMEOUT_MS)
    const result = await runOpenRouterSmokeCall(signal)

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "OpenRouter smoke call failed.",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      selector: result.data.response.nextUISelector,
      hasAssistantText: result.data.response.assistantText.length > 0,
      modelReturned: result.data.model.length > 0,
    })
  } catch (error) {
    if (error instanceof OpenRouterConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Server OpenRouter configuration is incomplete.",
          missingVariables: error.missingVariables,
        },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("OpenRouter smoke route diagnostic", {
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: "OpenRouter smoke route failed.",
      },
      { status: 500 }
    )
  }
}

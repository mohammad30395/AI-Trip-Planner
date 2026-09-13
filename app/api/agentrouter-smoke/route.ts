import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  AGENTROUTER_BASE_URL,
  AGENTROUTER_MESSAGES_PATH,
  AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM,
  AgentRouterConfigurationError,
  type AgentRouterFailureCode,
  runAgentRouterStructuredSmoke,
} from "@/lib/ai/agentrouter"

export const runtime = "nodejs"

export async function GET() {
  await auth.protect()

  try {
    const result = await runAgentRouterStructuredSmoke()

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: "agentrouter",
          error: "AgentRouter smoke call failed.",
          code: result.code,
          endpointPath: AGENTROUTER_MESSAGES_PATH,
          structuredOutputMechanism: AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM,
        },
        { status: statusForAgentRouterFailure(result.code) }
      )
    }

    return NextResponse.json({
      ok: true,
      provider: "agentrouter",
      baseUrl: AGENTROUTER_BASE_URL,
      endpointPath: AGENTROUTER_MESSAGES_PATH,
      transportSucceeded: true,
      structuredOutputMechanism: result.data.structuredOutputMechanism,
      runtimeValidationSucceeded: true,
      smokeContract: "ok_message",
      contentBlockTypes: result.data.contentBlockTypes,
      stopReason: result.data.stopReason,
      modelReturned: result.data.model.length > 0,
      messageReturned: result.data.response.message.length > 0,
    })
  } catch (error) {
    if (error instanceof AgentRouterConfigurationError) {
      return NextResponse.json(
        {
          ok: false,
          provider: "agentrouter",
          error: "Server AgentRouter configuration is incomplete.",
          missingVariables: error.missingVariables,
          endpointPath: AGENTROUTER_MESSAGES_PATH,
          structuredOutputMechanism: AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM,
        },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("AgentRouter smoke route diagnostic", {
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }

    return NextResponse.json(
      {
        ok: false,
        provider: "agentrouter",
        error: "AgentRouter smoke route failed.",
        endpointPath: AGENTROUTER_MESSAGES_PATH,
        structuredOutputMechanism: AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM,
      },
      { status: 500 }
    )
  }
}

function statusForAgentRouterFailure(code: AgentRouterFailureCode): number {
  switch (code) {
    case "provider_auth_error":
    case "configuration_error":
      return 500
    case "provider_rate_limited":
      return 429
    case "provider_timeout":
      return 504
    default:
      return 502
  }
}

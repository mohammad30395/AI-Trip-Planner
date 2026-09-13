import { auth } from "@clerk/nextjs/server"
import { afterEach, describe, expect, test, vi } from "vitest"

import { GET } from "@/app/api/agentrouter-smoke/route"
import { runAgentRouterStructuredSmoke } from "@/lib/ai/agentrouter"

vi.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: vi.fn(async () => undefined),
  },
}))

vi.mock("@/lib/ai/agentrouter", () => {
  class AgentRouterConfigurationError extends Error {
    readonly missingVariables: string[]

    constructor(missingVariables: string[]) {
      super("AgentRouter configuration is incomplete.")
      this.name = "AgentRouterConfigurationError"
      this.missingVariables = missingVariables
    }
  }

  return {
    AGENTROUTER_BASE_URL: "https://co.agentrouter.org",
    AGENTROUTER_MESSAGES_PATH: "/v1/messages",
    AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM:
      "anthropic_messages_output_config_json_schema",
    AgentRouterConfigurationError,
    runAgentRouterStructuredSmoke: vi.fn(),
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("AgentRouter smoke route", () => {
  test("requires Clerk auth and returns only safe smoke metadata", async () => {
    vi.mocked(runAgentRouterStructuredSmoke).mockResolvedValueOnce({
      ok: true,
      data: {
        response: {
          ok: true,
          message: "Provider text stays server-side.",
        },
        model: "claude-test",
        contentBlockTypes: ["text"],
        stopReason: "end_turn",
        structuredOutputMechanism:
          "anthropic_messages_output_config_json_schema",
      },
    })

    const response = await GET()
    const body = await response.json()

    expect(auth.protect).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      provider: "agentrouter",
      baseUrl: "https://co.agentrouter.org",
      endpointPath: "/v1/messages",
      transportSucceeded: true,
      structuredOutputMechanism:
        "anthropic_messages_output_config_json_schema",
      runtimeValidationSucceeded: true,
      smokeContract: "ok_message",
      contentBlockTypes: ["text"],
      stopReason: "end_turn",
      modelReturned: true,
      messageReturned: true,
    })
  })

  test("keeps provider failures sanitized", async () => {
    vi.mocked(runAgentRouterStructuredSmoke).mockResolvedValueOnce({
      ok: false,
      code: "provider_error",
      error: "Sanitized adapter error.",
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      provider: "agentrouter",
      error: "AgentRouter smoke call failed.",
      code: "provider_error",
      endpointPath: "/v1/messages",
      structuredOutputMechanism:
        "anthropic_messages_output_config_json_schema",
    })
  })
})

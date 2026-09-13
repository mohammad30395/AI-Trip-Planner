import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  AGENTROUTER_MESSAGES_ENDPOINT,
  AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM,
  AgentRouterConfigurationError,
  parseAgentRouterSmokeResponse,
  runAgentRouterConversationCompatibilitySmoke,
  runAgentRouterStructuredSmoke,
} from "@/lib/ai/agentrouter"

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AgentRouter adapter", () => {
  test("requires server-side AgentRouter configuration", async () => {
    delete process.env.AGENTROUTER_API_KEY
    delete process.env.AGENTROUTER_MODEL

    await expect(runAgentRouterStructuredSmoke()).rejects.toEqual(
      expect.objectContaining({
        name: "AgentRouterConfigurationError",
        missingVariables: ["AGENTROUTER_API_KEY", "AGENTROUTER_MODEL"],
      }) satisfies AgentRouterConfigurationError
    )
  })

  test("requests Anthropic Messages JSON schema output and validates smoke data", async () => {
    process.env.AGENTROUTER_API_KEY = "test-key"
    process.env.AGENTROUTER_MODEL = "claude-test"
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        type: "message",
        model: "claude-test",
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              message: "Structured output works.",
            }),
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await runAgentRouterStructuredSmoke()

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.error)
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(AGENTROUTER_MESSAGES_ENDPOINT)
    expect(init?.method).toBe("POST")
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    })

    const body = JSON.parse(String(init?.body)) as {
      model: string
      output_config?: {
        format?: {
          type?: string
          schema?: unknown
        }
      }
      messages?: unknown
      stream?: unknown
    }

    expect(body.model).toBe("claude-test")
    expect(body.stream).toBe(false)
    expect(body.messages).toEqual([
      {
        role: "user",
        content:
          "Return ok true and a short message confirming structured output works.",
      },
    ])
    expect(body.output_config?.format?.type).toBe("json_schema")
    expect(body.output_config?.format?.schema).toMatchObject({
      additionalProperties: false,
    })
    expect(result.data.response).toEqual({
      ok: true,
      message: "Structured output works.",
    })
    expect(result.data.contentBlockTypes).toEqual(["text"])
    expect(result.data.structuredOutputMechanism).toBe(
      AGENTROUTER_STRUCTURED_OUTPUT_MECHANISM
    )
  })

  test("sanitizes provider status failures without reading raw bodies", async () => {
    process.env.AGENTROUTER_API_KEY = "test-key"
    process.env.AGENTROUTER_MODEL = "claude-test"
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response("raw provider body", {
          status: 401,
          headers: { "Content-Type": "text/plain" },
        })
      )
    )

    const result = await runAgentRouterStructuredSmoke()

    expect(result).toEqual({
      ok: false,
      code: "provider_auth_error",
      error: "AgentRouter authentication failed",
      status: 401,
    })
  })

  test("classifies malformed successful provider responses", async () => {
    process.env.AGENTROUTER_API_KEY = "test-key"
    process.env.AGENTROUTER_MODEL = "claude-test"
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        })
      )
    )

    const result = await runAgentRouterStructuredSmoke()

    expect(result).toEqual({
      ok: false,
      code: "malformed_response",
      error: "AgentRouter response was malformed",
    })
  })

  test("rejects invalid structured JSON before returning smoke success", async () => {
    process.env.AGENTROUTER_API_KEY = "test-key"
    process.env.AGENTROUTER_MODEL = "claude-test"
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                message: "Nope.",
              }),
            },
          ],
        })
      )
    )

    const result = await runAgentRouterStructuredSmoke()

    expect(result).toEqual({
      ok: false,
      code: "structured_output_failed",
      error: "Smoke response ok must be true",
    })
  })

  test("classifies provider timeouts", async () => {
    process.env.AGENTROUTER_API_KEY = "test-key"
    process.env.AGENTROUTER_MODEL = "claude-test"
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValueOnce(
        new DOMException("Aborted", "AbortError")
      )
    )

    const result = await runAgentRouterStructuredSmoke()

    expect(result).toEqual({
      ok: false,
      code: "provider_timeout",
      error: "AgentRouter provider call timed out",
    })
  })

  test("validates the existing conversational contract shape", async () => {
    process.env.AGENTROUTER_API_KEY = "test-key"
    process.env.AGENTROUTER_MODEL = "claude-test"
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse({
          type: "message",
          model: "claude-test",
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                assistantText: "Ready when you are.",
                nextUISelector: "source",
              }),
            },
          ],
        })
      )
    )

    const result = await runAgentRouterConversationCompatibilitySmoke()

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.error)
    }

    expect(result.data.response).toEqual({
      assistantText: "Ready when you are.",
      nextUISelector: "source",
    })
  })
})

describe("AgentRouter smoke response validation", () => {
  test("rejects unknown smoke fields", () => {
    expect(
      parseAgentRouterSmokeResponse({
        ok: true,
        message: "ok",
        extra: "not allowed",
      })
    ).toEqual({
      ok: false,
      error: "Unexpected smoke response field: extra",
    })
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

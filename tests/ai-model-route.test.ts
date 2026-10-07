import { auth } from "@clerk/nextjs/server"
import { afterEach, describe, expect, test, vi } from "vitest"

import { POST } from "@/app/api/ai-model/route"
import { runGroqConversationStep } from "@/lib/ai/groq"
import {
  runOpenRouterConversationStep,
  runOpenRouterFinalItinerary,
} from "@/lib/ai/openrouter"

vi.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: vi.fn(),
  },
}))

vi.mock("@/lib/ai/groq", () => ({
  GROQ_CONVERSATION_TIMEOUT_MS: 30_000,
  runGroqConversationStep: vi.fn(),
}))

vi.mock("@/lib/ai/openrouter", () => ({
  runOpenRouterConversationStep: vi.fn(),
  runOpenRouterFinalItinerary: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe("Groq-backed AI conversation route", () => {
  test("blocks unauthenticated requests before provider work", async () => {
    vi.mocked(auth.protect).mockRejectedValueOnce(new Error("Unauthenticated"))

    await expect(POST(jsonRequest(validRequestBody()))).rejects.toThrow(
      "Unauthenticated"
    )
    expect(runGroqConversationStep).not.toHaveBeenCalled()
    expectNoOpenRouterWork()
  })

  test("rejects malformed JSON before provider work", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)

    const response = await POST(
      new Request("http://localhost/api/ai-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Request body must be valid JSON.",
    })
    expect(runGroqConversationStep).not.toHaveBeenCalled()
    expectNoOpenRouterWork()
  })

  test("rejects an invalid request shape before provider work", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)

    const response = await POST(jsonRequest({ messages: [], requirements: {} }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Trip conversation request is invalid.",
    })
    expect(runGroqConversationStep).not.toHaveBeenCalled()
    expectNoOpenRouterWork()
  })

  test("calls Groq once and preserves the existing success envelope and updates", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)
    vi.mocked(runGroqConversationStep).mockResolvedValueOnce({
      ok: true,
      data: {
        response: {
          assistantText: "Where would you like to go?",
          nextUISelector: "destination",
          requirementUpdate: { source: "Dhaka" },
        },
        modelReturned: true,
      },
    })

    const response = await POST(jsonRequest(validRequestBody()))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      response: {
        assistantText: "Where would you like to go?",
        nextUISelector: "destination",
        requirementUpdate: { source: "Dhaka" },
      },
    })
    expect(runGroqConversationStep).toHaveBeenCalledTimes(1)

    const [providerRequest, signal] = vi.mocked(runGroqConversationStep).mock
      .calls[0]
    expect(providerRequest).toMatchObject({
      maxCompletionTokens: 700,
      messages: [
        {
          role: "system",
          content: expect.stringContaining("trip-planning interviewer"),
        },
        {
          role: "user",
          content: "Current normalized requirements JSON: {}",
        },
        {
          role: "user",
          content: "I will start in Dhaka.",
        },
      ],
    })
    expect(signal).toBeInstanceOf(AbortSignal)
    expectNoOpenRouterWork()
  })

  test("normalizes a premature review selector to the first missing field", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)
    vi.mocked(runGroqConversationStep).mockResolvedValueOnce(
      groqSuccess("review")
    )

    const response = await POST(
      jsonRequest({
        messages: [{ role: "user", content: "Start in Dhaka." }],
        requirements: { source: "Dhaka" },
      })
    )

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      response: { nextUISelector: "destination" },
    })
    expectNoOpenRouterWork()
  })

  test("keeps a completed conversation at review without generating an itinerary", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)
    vi.mocked(runGroqConversationStep).mockResolvedValueOnce(
      groqSuccess("final")
    )

    const response = await POST(
      jsonRequest({
        messages: [{ role: "user", content: "That trip brief is correct." }],
        requirements: completeRequirements,
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      response: { nextUISelector: "review" },
    })
    expect(body.response).not.toHaveProperty("itinerary")
    expect(runGroqConversationStep).toHaveBeenCalledOnce()
    expectNoOpenRouterWork()
  })

  test.each([
    "configuration",
    "provider_error",
    "provider_timeout",
    "rate_limited",
    "invalid_json",
    "schema_validation",
    "empty_response",
    "output_truncated",
  ] as const)("uses the deterministic fallback for %s", async (code) => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)
    vi.mocked(runGroqConversationStep).mockResolvedValueOnce({
      ok: false,
      code,
      error: "raw-provider-detail unit-test-secret",
    })

    const response = await POST(
      jsonRequest({
        messages: [{ role: "user", content: "Start in Dhaka." }],
        requirements: { source: "Dhaka" },
      })
    )
    const body = await response.json()
    const serialized = JSON.stringify(body)

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      response: { nextUISelector: "destination" },
    })
    expect(serialized).not.toContain("raw-provider-detail")
    expect(serialized).not.toContain("unit-test-secret")
    expect(runGroqConversationStep).toHaveBeenCalledOnce()
    expectNoOpenRouterWork()
  })
})

function expectNoOpenRouterWork() {
  expect(runOpenRouterConversationStep).not.toHaveBeenCalled()
  expect(runOpenRouterFinalItinerary).not.toHaveBeenCalled()
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validRequestBody() {
  return {
    messages: [{ role: "user", content: "I will start in Dhaka." }],
    requirements: {},
  }
}

function groqSuccess(nextUISelector: "review" | "final") {
  return {
    ok: true as const,
    data: {
      response: {
        assistantText: "Review your trip brief.",
        nextUISelector,
      },
      modelReturned: true,
    },
  }
}

const completeRequirements = {
  source: "Dhaka",
  destination: "Tokyo",
  durationDays: 3,
  budgetTier: "mid-range",
  groupSize: 2,
  groupType: "couple",
}

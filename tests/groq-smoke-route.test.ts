import { auth } from "@clerk/nextjs/server"
import { afterEach, describe, expect, test, vi } from "vitest"

import { GET } from "@/app/api/groq-smoke/route"
import {
  checkGroqModelAvailability,
  runGroqConversationSmoke,
  runGroqStrictCapabilitySmoke,
} from "@/lib/ai/groq"

vi.mock("@clerk/nextjs/server", () => ({
  auth: {
    protect: vi.fn(),
  },
}))

vi.mock("@/lib/ai/groq", () => ({
  GROQ_SMOKE_TIMEOUT_MS: 30_000,
  checkGroqModelAvailability: vi.fn(),
  runGroqConversationSmoke: vi.fn(),
  runGroqStrictCapabilitySmoke: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe("authenticated Groq smoke route", () => {
  test("authenticates before running only the isolated Groq checks", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)
    vi.mocked(checkGroqModelAvailability).mockResolvedValueOnce({
      ok: true,
      data: { accessible: true },
    })
    vi.mocked(runGroqStrictCapabilitySmoke).mockResolvedValueOnce({
      ok: true,
      data: { validated: true, modelReturned: true },
    })
    vi.mocked(runGroqConversationSmoke).mockResolvedValueOnce({
      ok: true,
      data: {
        response: {
          assistantText: "Where will your trip start?",
          nextUISelector: "source",
        },
        modelReturned: true,
      },
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      provider: "groq",
      modelConfigured: true,
      modelAccessible: true,
      existingSchemaTest: {
        ok: true,
        validated: true,
        selector: "source",
      },
      strictCapabilityTest: {
        ok: true,
        validated: true,
      },
    })
    expect(auth.protect).toHaveBeenCalledOnce()
    expect(checkGroqModelAvailability).toHaveBeenCalledOnce()
    expect(runGroqStrictCapabilitySmoke).toHaveBeenCalledOnce()
    expect(runGroqConversationSmoke).toHaveBeenCalledOnce()
    expect(vi.mocked(auth.protect).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(checkGroqModelAvailability).mock.invocationCallOrder[0]
    )
  })

  test("blocks unauthenticated requests before any Groq work", async () => {
    vi.mocked(auth.protect).mockRejectedValueOnce(new Error("Unauthenticated"))

    await expect(GET()).rejects.toThrow("Unauthenticated")
    expect(checkGroqModelAvailability).not.toHaveBeenCalled()
    expect(runGroqStrictCapabilitySmoke).not.toHaveBeenCalled()
    expect(runGroqConversationSmoke).not.toHaveBeenCalled()
  })

  test("returns a sanitized bounded rate-limit response and stops", async () => {
    vi.mocked(auth.protect).mockResolvedValueOnce({} as never)
    vi.mocked(checkGroqModelAvailability).mockResolvedValueOnce({
      ok: false,
      code: "rate_limited",
      error: "Provider detail that must remain private.",
      retryAfterSeconds: 60,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({
      ok: false,
      provider: "groq",
      stage: "model_availability",
      code: "rate_limited",
      error: "GROQ_RATE_LIMIT_BLOCKED",
      retryAfterSeconds: 60,
    })
    expect(JSON.stringify(body)).not.toContain("Provider detail")
    expect(runGroqStrictCapabilitySmoke).not.toHaveBeenCalled()
    expect(runGroqConversationSmoke).not.toHaveBeenCalled()
  })
})

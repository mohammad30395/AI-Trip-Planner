#!/usr/bin/env node
import { spawnSync } from "node:child_process"

const hasConvexDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY?.trim())
const hasConvexUrl = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL?.trim())

if (hasConvexDeployKey) {
  run("convex", [
    "deploy",
    "--cmd",
    "npm run build",
    "--cmd-url-env-var-name",
    "NEXT_PUBLIC_CONVEX_URL",
  ])
} else if (hasConvexUrl) {
  console.warn(
    [
      "CONVEX_DEPLOY_KEY is not configured, so Convex functions will not be deployed by this Vercel build.",
      "Using existing NEXT_PUBLIC_CONVEX_URL for the Next.js build.",
      "Make sure Convex functions are deployed separately before using this production deployment.",
    ].join(" ")
  )
  run("npm", ["run", "build"])
} else {
  console.error(
    [
      "Vercel deployment cannot continue because Convex is not configured.",
      "Set CONVEX_DEPLOY_KEY in Vercel Environment Variables so Convex can deploy and inject NEXT_PUBLIC_CONVEX_URL.",
      "Alternatively, deploy Convex separately and set NEXT_PUBLIC_CONVEX_URL in Vercel.",
      "Do not copy .env.local values into source control.",
    ].join(" ")
  )
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  })

  if (result.error !== undefined) {
    console.error(`Failed to start ${command}.`)
    process.exit(1)
  }

  process.exit(result.status ?? 1)
}

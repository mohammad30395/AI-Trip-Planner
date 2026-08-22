import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function AppContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("app-container", className)} {...props} />
}

export { AppContainer }

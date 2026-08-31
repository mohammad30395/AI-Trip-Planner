import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AppStatePanelTone = "primary" | "destructive" | "success" | "neutral"

const toneClasses: Record<AppStatePanelTone, string> = {
  primary: "bg-accent text-primary",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  neutral: "bg-soft-surface text-muted-foreground",
}

type AppStatePanelProps = {
  action?: ReactNode
  align?: "left" | "center"
  busy?: boolean
  className?: string
  description: ReactNode
  icon: LucideIcon
  title: string
  tone?: AppStatePanelTone
}

function AppStatePanel({
  action,
  align = "left",
  busy = false,
  className,
  description,
  icon: Icon,
  title,
  tone = "primary",
}: AppStatePanelProps) {
  const isCentered = align === "center"

  return (
    <Card
      aria-busy={busy || undefined}
      className={cn(
        "app-panel p-0",
        isCentered ? "text-center" : "text-left",
        className
      )}
    >
      <CardHeader
        className={cn(
          "px-5 py-5 sm:px-6 sm:py-6",
          isCentered && "items-center"
        )}
      >
        <div
          className={cn(
            "flex gap-3",
            isCentered ? "flex-col items-center" : "items-start"
          )}
        >
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-[var(--app-control-radius)]",
              isCentered && "size-14 rounded-full",
              toneClasses[tone]
            )}
            aria-hidden="true"
          >
            <Icon className={cn("size-5", busy && "animate-spin")} />
          </span>
          <div className="min-w-0">
            <CardTitle className={cn(isCentered && "text-2xl")}>
              {title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6",
          isCentered && "justify-items-center"
        )}
      >
        <CardDescription className="max-w-prose leading-6">
          {description}
        </CardDescription>
        {action !== undefined ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  )
}

export { AppStatePanel }

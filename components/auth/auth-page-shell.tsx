import type { ReactNode } from "react"

import { AppContainer } from "@/components/app-container"
import { BrandLogo } from "@/components/brand/brand-logo"

type AuthPageShellProps = {
  children: ReactNode
  description: string
  title: string
}

function AuthPageShell({ children, description, title }: AuthPageShellProps) {
  return (
    <main className="min-h-dvh bg-background">
      <AppContainer className="grid min-h-dvh content-center py-8 sm:py-12">
        <section
          aria-labelledby="auth-page-title"
          className="mx-auto grid w-full max-w-md gap-6"
        >
          <div className="grid justify-items-center gap-4 text-center">
            <BrandLogo />
            <div className="grid gap-2">
              <h1
                id="auth-page-title"
                className="font-heading text-3xl leading-tight font-bold tracking-normal text-foreground"
              >
                {title}
              </h1>
              <p className="app-muted text-sm leading-6">{description}</p>
            </div>
          </div>
          <div className="min-w-0">{children}</div>
        </section>
      </AppContainer>
    </main>
  )
}

export { AuthPageShell }

import type { ReactNode } from "react"

import { AuthControls } from "@/components/auth/auth-controls"
import { AppContainer } from "@/components/app-container"
import { HeaderShell } from "@/components/navigation/header-shell"

const appNavItems = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
]

function AppRouteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HeaderShell
        navItems={appNavItems}
        navLabel="App navigation"
        actions={<AuthControls />}
        mobileActions={<AuthControls layout="mobile" />}
      />
      <main className="flex-1 bg-muted/20">
        <AppContainer className="py-10 sm:py-14">{children}</AppContainer>
      </main>
    </>
  )
}

export default AppRouteLayout

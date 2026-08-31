import type { ReactNode } from "react"

import { AppContainer } from "@/components/app-container"
import { BrandLogo } from "@/components/brand/brand-logo"
import { MobileNav } from "@/components/navigation/mobile-nav"
import { NavLinks, type HeaderNavItem } from "@/components/navigation/nav-links"

type HeaderShellProps = {
  navItems: HeaderNavItem[]
  actions: ReactNode
  mobileActions?: ReactNode
  navLabel: string
}

function HeaderShell({
  navItems,
  actions,
  mobileActions,
  navLabel,
}: HeaderShellProps) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-border/70 bg-background/95">
      <AppContainer className="grid h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="min-w-0 justify-self-start">
          <BrandLogo />
        </div>

        <nav
          className="hidden items-center justify-center gap-2 lg:flex"
          aria-label={navLabel}
        >
          <NavLinks items={navItems} />
        </nav>

        <div className="hidden justify-self-end lg:flex">{actions}</div>

        <MobileNav
          items={navItems}
          actions={mobileActions ?? actions}
          navLabel={navLabel}
          className="col-start-2 row-start-1 justify-self-end"
        />
      </AppContainer>
    </header>
  )
}

export { HeaderShell }

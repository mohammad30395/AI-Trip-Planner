import { AuthControls } from "@/components/auth/auth-controls"
import { HeaderShell } from "@/components/navigation/header-shell"

const navItems = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
]

function SiteHeader() {
  return (
    <HeaderShell
      navItems={navItems}
      navLabel="Main navigation"
      actions={<AuthControls />}
      mobileActions={<AuthControls layout="mobile" />}
    />
  )
}

export { SiteHeader }

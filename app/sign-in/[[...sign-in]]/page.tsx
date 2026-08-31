import { SignIn } from "@clerk/nextjs"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { clerkAuthAppearance } from "@/components/auth/clerk-appearance"

function SignInPage() {
  return (
    <AuthPageShell
      title="Welcome back"
      description="Sign in to continue planning and manage your saved trips."
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={clerkAuthAppearance}
      />
    </AuthPageShell>
  )
}

export default SignInPage

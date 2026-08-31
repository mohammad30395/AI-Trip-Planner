import { SignUp } from "@clerk/nextjs"

import { AuthPageShell } from "@/components/auth/auth-page-shell"
import { clerkAuthAppearance } from "@/components/auth/clerk-appearance"

function SignUpPage() {
  return (
    <AuthPageShell
      title="Create your account"
      description="Start planning with the same trip workspace and saved itinerary dashboard."
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        appearance={clerkAuthAppearance}
      />
    </AuthPageShell>
  )
}

export default SignUpPage

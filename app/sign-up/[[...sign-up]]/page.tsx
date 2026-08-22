import { SignUp } from "@clerk/nextjs"

import { AppContainer } from "@/components/app-container"

function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 py-12">
      <AppContainer className="flex justify-center">
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </AppContainer>
    </main>
  )
}

export default SignUpPage

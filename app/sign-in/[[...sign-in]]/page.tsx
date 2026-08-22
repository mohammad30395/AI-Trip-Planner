import { SignIn } from "@clerk/nextjs"

import { AppContainer } from "@/components/app-container"

function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 py-12">
      <AppContainer className="flex justify-center">
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </AppContainer>
    </main>
  )
}

export default SignInPage

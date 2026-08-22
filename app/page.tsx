import { AppContainer } from "@/components/app-container";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center">
      <AppContainer>
        <div className="w-full max-w-2xl">
          <p className="app-muted text-sm font-medium uppercase tracking-wider">
            AI Trip Planner
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Trip planning starts here.
          </h1>
          <p className="app-muted mt-5 max-w-xl text-lg leading-8">
            This base Next.js app is ready for the product milestones that
            follow.
          </p>
        </div>
      </AppContainer>
    </main>
  );
}

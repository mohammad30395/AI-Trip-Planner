const clerkAuthAppearance = {
  variables: {
    borderRadius: "0.875rem",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorInputText: "#14110f",
    colorPrimary: "#ff4f0a",
    colorText: "#14110f",
    colorTextSecondary: "#716a64",
    fontFamily: "var(--font-poppins)",
  },
  elements: {
    cardBox:
      "w-full max-w-md rounded-[var(--app-panel-radius)] border border-border bg-background shadow-[var(--app-shadow-card)]",
    footerActionLink: "font-medium text-primary hover:text-brand-orange-hover",
    formButtonPrimary:
      "rounded-[var(--app-control-radius)] bg-primary text-primary-foreground shadow-[var(--app-shadow-primary)] hover:bg-brand-orange-hover",
    formFieldInput:
      "rounded-[var(--app-control-radius)] border-border bg-background text-foreground focus:border-ring focus:ring-brand-orange/30",
    formFieldLabel: "font-medium text-foreground",
    headerSubtitle: "text-muted-foreground",
    headerTitle:
      "font-heading text-2xl font-bold tracking-normal text-foreground",
    rootBox: "w-full",
    socialButtonsBlockButton:
      "rounded-[var(--app-control-radius)] border-border bg-background hover:bg-soft-surface",
  },
} as const

export { clerkAuthAppearance }

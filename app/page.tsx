import { HeroSection } from "@/components/landing/hero-section"
import { HowItWorks } from "@/components/landing/how-it-works"
import { ProductPreview } from "@/components/landing/product-preview"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <ProductPreview />
        <HowItWorks />
      </main>
      <SiteFooter />
    </>
  )
}

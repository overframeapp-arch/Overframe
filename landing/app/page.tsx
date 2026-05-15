import { HeroSection } from '@/components/HeroSection'
import { ProblemSection } from '@/components/ProblemSection'
import { FeaturesGrid } from '@/components/FeaturesGrid'
import { ShortcutsShowcase } from '@/components/ShortcutsShowcase'
import { CTABanner } from '@/components/CTABanner'

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <FeaturesGrid />
      <ShortcutsShowcase />
      <CTABanner />
    </>
  )
}

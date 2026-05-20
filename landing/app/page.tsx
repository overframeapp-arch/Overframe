import { HeroSection } from '@/components/HeroSection'
import { DemoVideo } from '@/components/DemoVideo'
import { HowItWorks } from '@/components/HowItWorks'
import { CommunitySection } from '@/components/CommunitySection'
import { TrustSecurity } from '@/components/TrustSecurity'
import { CreatorNote } from '@/components/CreatorNote'
import { FAQSection } from '@/components/FAQSection'
import { CTABanner } from '@/components/CTABanner'

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <DemoVideo src="/demo.mp4" />
      <HowItWorks />
      <CreatorNote />
      <CommunitySection />
      <FAQSection />
      <TrustSecurity />
      <CTABanner />
    </>
  )
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms governing the use of Overframe and overframe.app.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  const updated = 'May 2026'
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header>
        <p className="text-sm uppercase tracking-widest text-primary/80">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          Terms of Use
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      </header>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground">

        <section>
          <p>
            These Terms of Use govern your use of the Overframe desktop application
            and the overframe.app website. They are published by the independent
            developer operating this project (“the developer”, “we”). By installing
            or using the software, you agree to these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Licence</h2>
          <p className="mt-2">
            Overframe is distributed under the MIT licence. You are free to use, copy,
            modify and distribute the software, including for commercial purposes, on
            the condition that you preserve the original copyright notice. The full
            licence text is bundled with the application and available in the GitHub
            repository.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. No warranty</h2>
          <p className="mt-2">
            The software is provided &ldquo;as is&rdquo; without warranty of any kind,
            express or implied. The authors are not liable for any damages arising from
            the use of this software, to the extent permitted by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. Acceptable use</h2>
          <p className="mt-2">
            You agree not to use Overframe to engage in activity that violates the
            terms of any third-party game, platform or service, including but not
            limited to automation against the will of a game publisher, real-money
            trading where prohibited, or harassment. Overframe is a passive overlay
            and does not interact with game memory or processes — but how you use the
            information it displays is your responsibility.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Trademarks</h2>
          <p className="mt-2">
            Game titles, launcher names and platform logos referenced anywhere on this
            site or inside the application are the property of their respective
            owners. Overframe is not affiliated with, endorsed by or sponsored by any
            of those parties.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Third-party content</h2>
          <p className="mt-2">
            Overframe lets you display web pages of your choice. We do not control
            their content and are not responsible for it. Your use of those pages is
            governed by the terms of those websites.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Changes</h2>
          <p className="mt-2">
            We may update these terms from time to time. If changes are material,
            a notice will be posted on this page and announced via the Discord server
            at least 30 days before the change takes effect. You may reject the new
            terms by uninstalling the application and ceasing to use the website.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Governing law</h2>
          <p className="mt-2">
            These terms are governed by the laws of the user&rsquo;s country of
            residence to the extent required by applicable consumer protection law,
            and otherwise by French law. Any dispute that cannot be resolved amicably
            shall be submitted to the competent courts of France.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">8. Severability</h2>
          <p className="mt-2">
            If any provision of these Terms is found to be invalid or unenforceable
            under applicable law, that provision will be modified to the minimum
            extent necessary to make it enforceable, or severed if modification is
            not possible. The remaining provisions continue in full force and effect.
          </p>
        </section>
      </div>
    </article>
  )
}

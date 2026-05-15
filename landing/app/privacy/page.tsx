import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Overframe collects no personal data. Everything stays on your device — no accounts, no telemetry, no cloud sync.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  const updated = 'May 2026'
  return (
    <article className="prose-invert mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header>
        <p className="text-sm uppercase tracking-widest text-primary/80">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      </header>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-xl font-semibold text-foreground">Summary</h2>
          <p className="mt-2">
            Overframe is a desktop application that runs entirely on your computer. It
            does not collect, transmit or sell personal data. There are no user
            accounts, no analytics SDK, no telemetry, no crash reporting service and
            no cloud sync.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Data we store locally</h2>
          <p className="mt-2">
            Settings, profiles, collections, browsing history and cookies created by
            your browsing activity are written to a local file on your machine
            (typically <code>%APPDATA%/overframe/</code>). This data never leaves your
            computer and can be deleted at any time by removing that folder or
            uninstalling the app.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Network requests we make</h2>
          <p className="mt-2">
            The application itself does not contact any Overframe-controlled server.
            The only outbound traffic originates from:
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-6">
            <li>The websites you choose to visit through the overlay browser.</li>
            <li>The favicon service used to fetch site icons (<code>www.google.com/s2/favicons</code>).</li>
            <li>An optional update check against GitHub Releases.</li>
          </ul>
          <p className="mt-3">
            Network requests sent to known advertising and tracking domains are
            blocked at the request level by the built-in ad blocker.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">3. This website (overframe.app)</h2>
          <p className="mt-2">
            The marketing website does not use cookies, tracking pixels, fingerprinting
            scripts or third-party analytics. Standard server access logs may be
            retained by our hosting provider for security and abuse prevention.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Children</h2>
          <p className="mt-2">
            Overframe is not directed at children under 13. We do not knowingly
            collect data from any user.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Your rights (GDPR / CCPA)</h2>
          <p className="mt-2">
            Because we do not store personal data on any server, requests for access,
            correction or deletion are satisfied automatically — uninstalling the app
            removes all data we ever held about you. For questions, contact us at the
            address listed below.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Changes</h2>
          <p className="mt-2">
            If this policy changes in the future, the updated version will be posted
            on this page with a new &ldquo;last updated&rdquo; date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Contact</h2>
          <p className="mt-2">
            Questions about this policy can be sent to{' '}
            <a href="/contact" className="text-foreground underline hover:text-primary">
              the contact page
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  )
}

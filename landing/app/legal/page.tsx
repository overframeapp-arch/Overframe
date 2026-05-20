import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Legal Notice',
  description: 'Legal notice for overframe.app — publisher identity, hosting, intellectual property and applicable law.',
  alternates: { canonical: '/legal' },
  robots: { index: false },
}

export default function LegalPage() {
  const updated = 'May 20, 2026'

  return (
    <article className="prose-invert mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header>
        <p className="text-sm uppercase tracking-widest text-primary/80">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          Legal Notice
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Published pursuant to French law n° 2004-575 of 21 June 2004 (LCEN, art. 6-III).
          Last updated: {updated}
        </p>
      </header>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted-foreground">

        {/* 1 — Publisher */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">1. Publisher</h2>
          <p className="mt-2">
            overframe.app is published by an independent developer acting as a private individual:
          </p>
          <ul className="mt-3 list-none space-y-1.5 pl-0">
            <li><strong className="text-foreground">Name:</strong> Lucas Hatron</li>
            <li><strong className="text-foreground">Country:</strong> France</li>
            <li>
              <strong className="text-foreground">Email:</strong>{' '}
              <a href="mailto:contact@overframe.app" className="text-foreground underline hover:text-primary">
                contact@overframe.app
              </a>
            </li>
            <li><strong className="text-foreground">Publication director:</strong> Lucas Hatron</li>
          </ul>
          <p className="mt-3 text-[0.85em]">
            Full contact details are available on request at the email address above,
            in accordance with article 6-III-2° of the LCEN.
          </p>
        </section>

        {/* 2 — Hosting */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">2. Hosting</h2>
          <p className="mt-2">overframe.app is hosted by:</p>
          <ul className="mt-3 list-none space-y-1.5 pl-0">
            <li><strong className="text-foreground">Provider:</strong> Cloudflare, Inc.</li>
            <li><strong className="text-foreground">Address:</strong> 101 Townsend St., San Francisco, CA 94107, USA</li>
            <li>
              <strong className="text-foreground">Website:</strong>{' '}
              <a
                href="https://www.cloudflare.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline hover:text-primary"
              >
                cloudflare.com
              </a>
            </li>
          </ul>
        </section>

        {/* 3 — Intellectual property */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">3. Intellectual property</h2>
          <p className="mt-2">
            The Overframe application source code is distributed under the{' '}
            <strong className="text-foreground">MIT licence</strong>. You are free to use, copy,
            modify and distribute it, including for commercial purposes, provided the original
            copyright notice is preserved.
          </p>
          <p className="mt-3">
            The editorial content of overframe.app (text, visuals, logotype) is the property
            of the publisher. Reproduction without prior authorisation is prohibited.
          </p>
          <p className="mt-3">
            Game titles, launcher names and platform logos mentioned on this site (Steam,
            Epic Games, Riot, etc.) are the property of their respective owners.
            Overframe is not affiliated with, endorsed by or sponsored by any of those companies.
          </p>
        </section>

        {/* 4 — Personal data */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">4. Personal data &amp; cookies</h2>
          <p className="mt-2">
            overframe.app sets no cookies, uses no advertising trackers and collects no personal
            data from visitors. Standard server access logs retained by Cloudflare may contain
            IP addresses for security and abuse-prevention purposes; these are governed by{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline hover:text-primary"
            >
              Cloudflare&apos;s privacy policy
            </a>.
          </p>
          <p className="mt-3">
            For information on data handling by the Overframe application itself, see the{' '}
            <Link href="/privacy" className="text-foreground underline hover:text-primary">
              Privacy Policy
            </Link>.
          </p>
        </section>

        {/* 5 — Liability */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">5. Limitation of liability</h2>
          <p className="mt-2">
            The publisher makes reasonable efforts to keep the information on this site accurate
            and up to date. He shall not be held liable for any direct or indirect damages
            resulting from the use of this site or the application, to the extent permitted by
            applicable law.
          </p>
        </section>

        {/* 6 — Governing law */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">6. Governing law</h2>
          <p className="mt-2">
            This legal notice is governed by French law. In the event of a dispute that cannot
            be resolved amicably, the competent courts of France shall have jurisdiction,
            without prejudice to mandatory consumer-protection provisions applicable in the
            user&apos;s country of residence.
          </p>
        </section>

        {/* 7 — Contact */}
        <section>
          <h2 className="text-xl font-semibold text-foreground">7. Contact</h2>
          <p className="mt-2">
            Any question relating to this legal notice can be sent to{' '}
            <a href="mailto:contact@overframe.app" className="text-foreground underline hover:text-primary">
              contact@overframe.app
            </a>
            {' '}or via the{' '}
            <Link href="/contact" className="text-foreground underline hover:text-primary">
              contact page
            </Link>.
          </p>
        </section>

      </div>
    </article>
  )
}

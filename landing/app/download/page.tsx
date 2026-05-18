import type { Metadata } from 'next'
import { Download, ShieldCheck } from 'lucide-react'
import { GithubIcon } from '@/components/GithubIcon'
import { SITE_CONFIG } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Download Overframe — Free for Windows',
  description:
    'Download the latest version of Overframe — the transparent in-game browser overlay for Windows 10 and 11. Free, open source, ~80 MB.',
  alternates: { canonical: '/download' },
}

const SYSTEM_REQS = [
  { label: 'Operating system', value: 'Windows 10 (64-bit) or Windows 11' },
  { label: 'Memory', value: '4 GB RAM minimum (8 GB recommended)' },
  { label: 'Disk space', value: '~250 MB after install' },
  { label: 'GPU', value: 'Any GPU with hardware compositing (basically all modern PCs)' },
]

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-primary/80">Download</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Get Overframe for Windows
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Free forever, open source. Releases are signed and built directly from the
          public GitHub repository.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={SITE_CONFIG.downloadUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_theme(colors.primary.DEFAULT)] transition hover:opacity-90"
          >
            <Download size={18} />
            Download installer (.exe)
          </a>
          <a
            href={SITE_CONFIG.links.github + '/releases'}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-6 py-3.5 text-base font-semibold transition hover:bg-muted"
          >
            <GithubIcon size={18} />
            All releases on GitHub
          </a>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          By downloading you agree to the{' '}
          <a href="/terms" className="underline hover:text-foreground">terms of use</a>.
        </p>
      </header>

      <section className="mt-16 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <h2 className="text-lg font-semibold">Safe to install</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Installers are built from open source by GitHub Actions and code-signed
              before release. Each release page lists SHA-256 checksums you can verify
              before running the binary.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">System requirements</h2>
        <dl className="mt-4 divide-y divide-border/60 rounded-2xl border border-border bg-muted/30">
          {SYSTEM_REQS.map((r) => (
            <div key={r.label} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3">
              <dt className="text-sm font-medium text-foreground">{r.label}</dt>
              <dd className="text-sm text-muted-foreground sm:col-span-2">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12 rounded-2xl border border-border bg-muted/30 p-6">
        <h2 className="text-lg font-semibold">SmartScreen warning?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Newly published builds may show a Windows SmartScreen warning until enough
          users have run them. Click <em>More info → Run anyway</em>. The installer is
          signed and the source code is fully public — you can build it yourself from
          the GitHub repository.
        </p>
      </section>
    </div>
  )
}

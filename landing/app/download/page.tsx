import type { Metadata } from 'next'
import { Download, ShieldCheck, AlertTriangle } from 'lucide-react'
import { GithubIcon } from '@/components/GithubIcon'
import { SITE_CONFIG } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Download Overframe — Free for Windows',
  description:
    'Download Overframe — the free, open-source in-game browser overlay for Windows 10 and 11. No account required.',  
  alternates: { canonical: '/download' },
}

const SYSTEM_REQS = [
  { label: 'OS', value: 'Windows 10 or 11 (64-bit)' },
  { label: 'RAM', value: '4 GB minimum' },
  { label: 'Disk', value: '~500 MB installed' },
  { label: 'GPU', value: 'DirectX 11 or later' },
]

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-primary/80">Windows · Free · Open source</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Download Overframe.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          One installer. No subscription, no account, no telemetry.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={SITE_CONFIG.downloadUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_theme(colors.primary.DEFAULT)] transition hover:opacity-90"
          >
            <Download size={18} />
            Download for Windows
          </a>
          <a
            href={SITE_CONFIG.links.github + '/releases'}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-6 py-3.5 text-base font-semibold transition hover:bg-muted"
          >
            <GithubIcon size={18} />
            All releases
          </a>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          By downloading you agree to the{' '}
          <a href="/terms" className="underline hover:text-foreground">terms of use</a>.
        </p>
      </header>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">Open source &amp; verified</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Code is fully public on GitHub. 71 of 72 antivirus engines give all-clear — one known false positive.{' '}
              <a href="/#security" className="underline hover:text-foreground">Details →</a>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">SmartScreen warning?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Normal for unsigned builds. Click{' '}
              <em>More info &rarr; Run anyway</em>{' '}
              to proceed.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">System requirements</p>
        <dl className="mt-3 divide-y divide-border/60 rounded-2xl border border-border bg-muted/30">
          {SYSTEM_REQS.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-5 py-3">
              <dt className="text-sm font-medium text-foreground">{r.label}</dt>
              <dd className="text-sm text-muted-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

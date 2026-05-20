'use client'

import { ShieldAlert, ShieldCheck, Lock } from 'lucide-react'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'
import { SITE_CONFIG } from '@/lib/config'

const VIRUSTOTAL_URL =
  'https://www.virustotal.com/gui/file/fb5e1ad4fed0f002553b92c2bac201c4d3f100c44fe8371bdd75ff9a5c5c7165/detection'

export function TrustSecurity() {
  const [ref, inView] = useInView<HTMLElement>()

  return (
    <section
      id="security"
      ref={ref}
      className="scroll-mt-20 border-y border-border/20 px-6 py-12"
      aria-label="Security"
    >
      <div className={cn('mx-auto max-w-container grid gap-8 sm:grid-cols-3 reveal', inView && 'in-view')}>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 shrink-0 text-primary/60" size={16} aria-hidden />
          <div>
            <p className="text-[0.84rem] font-semibold text-[var(--text-head)]">Windows SmartScreen warning</p>
            <p className="mt-1 text-[0.80rem] leading-relaxed text-[var(--text)]">
              Normal for new apps. Click{' '}
              <strong className="text-[var(--text-head)]">More info → Run anyway</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400/70" size={16} aria-hidden />
          <div>
            <p className="text-[0.84rem] font-semibold text-[var(--text-head)]">71/72 antivirus engines: all-clear</p>
            <p className="mt-1 text-[0.80rem] leading-relaxed text-[var(--text)]">
              One false positive — same scanner that flags VS Code and Discord.{' '}
              <a href={VIRUSTOTAL_URL} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">VirusTotal ↗</a>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 shrink-0 text-primary/60" size={16} aria-hidden />
          <div>
            <p className="text-[0.84rem] font-semibold text-[var(--text-head)]">Open source · No game interaction</p>
            <p className="mt-1 text-[0.80rem] leading-relaxed text-[var(--text)]">
              Sits on top like any regular window. Never reads or touches your game.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

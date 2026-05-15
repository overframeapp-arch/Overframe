import { useState } from 'react'
import { Layers, Sparkles, LayoutGrid } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface StepDef {
  Icon: React.ElementType
  eyebrow: string
  title: string
  desc: string
  shortcut?: { keys: string[]; hint: string }
}

const STEPS: StepDef[] = [
  {
    Icon: Layers,
    eyebrow: 'Welcome to Overframe',
    title: 'Never alt-tab again.',
    desc: "Overframe sits on top of any game — open it mid-match, look up what you need, then make it vanish. No window switching. No focus loss. Zero friction.",
    shortcut: { keys: ['Alt', 'B'], hint: '— toggle at any time' },
  },
  {
    Icon: Sparkles,
    eyebrow: 'Smart game detection',
    title: 'Launch a game. Get a fresh workspace.',
    desc: "Overframe recognizes hundreds of games on launch. The right profile — with its own tabs, bookmarks — is already waiting before you queue.",
  },
  {
    Icon: LayoutGrid,
    eyebrow: 'Built for your setup',
    title: 'Customize everything, per game.',
    desc: "Pin the wiki, your build guide, your squad Discord. Every game gets exactly what it needs — and nothing it doesn't.",
  },
]

export function OnboardingOverlay(): JSX.Element | null {
  const { settings, setSettings } = useAppStore()
  const [step, setStep] = useState(0)

  if (!settings || settings.hasCompletedOnboarding) return null

  const isLast = step === STEPS.length - 1
  const { Icon, eyebrow, title, desc, shortcut } = STEPS[step]

  const finish = async (): Promise<void> => {
    const next = await window.aether.settings.set('hasCompletedOnboarding', true)
    if (next) setSettings(next)
  }

  const handleNext = async (): Promise<void> => {
    if (!isLast) { setStep(step + 1); return }
    await finish()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 p-8 w-[340px] text-center bg-background border border-border/60 rounded-2xl shadow-2xl">

        {/* Step icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
          <Icon size={24} strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-primary/50">{eyebrow}</p>
          <h2 className="text-[17px] font-semibold leading-snug tracking-tight">{title}</h2>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{desc}</p>
          {shortcut && (
            <div className="flex items-center justify-center gap-1 flex-wrap mt-0.5">
              {shortcut.keys.map((k) => (
                <kbd
                  key={k}
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted border border-border rounded-md text-foreground/70 leading-none"
                >
                  {k}
                </kbd>
              ))}
              <span className="text-[10px] text-muted-foreground/40">{shortcut.hint}</span>
            </div>
          )}
        </div>

        {/* Step indicator — animated pill */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => void handleNext()}
            className="w-full h-9 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            {isLast ? 'Start browsing →' : 'Next →'}
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={() => void finish()}
              className="text-[10px] text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors"
            >
              Skip intro
            </button>
          )}
        </div>

      </div>
    </div>
  )
}


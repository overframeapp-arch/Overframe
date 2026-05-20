'use client'

import { useRef, useEffect } from 'react'
import { Play } from 'lucide-react'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

interface DemoVideoProps {
  /** Drop demo.mp4 in /public and pass src="/demo.mp4" when ready */
  src?: string
}

export function DemoVideo({ src }: DemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ref, inView] = useInView<HTMLElement>()

  useEffect(() => {
    if (inView && videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [inView])

  return (
    <section ref={ref} className="px-6 pb-12 pt-2">
      <div className={cn('mx-auto max-w-4xl reveal', inView && 'in-view')}>
        {/* Frame */}
        <div className="overflow-hidden rounded-2xl border border-primary/25 bg-[var(--bg-card)] shadow-[0_0_80px_-20px_rgba(124,58,237,0.45)]">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 border-b border-border/50 bg-[#0d0d16] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border/60" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-border/60" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-border/60" aria-hidden />
            <span className="ml-auto font-mono text-[0.65rem] text-muted-foreground/40">
              overframe — demo
            </span>
          </div>

          {/* Content */}
          {src ? (
            <video
              ref={videoRef}
              src={src}
              poster="/demo-poster.jpg"
              muted
              loop
              playsInline
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-5 overflow-hidden bg-[#08080f]">
              {/* Ambient glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  background:
                    'radial-gradient(ellipse 70% 50% at 50% 60%, rgba(124,58,237,0.18) 0%, transparent 70%)',
                }}
                aria-hidden
              />
              {/* Play button */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <Play size={24} className="ml-1 text-primary/70" aria-hidden />
              </div>
              <p className="relative text-sm text-muted-foreground">
                Demo video coming soon
              </p>
            </div>
          )}
        </div>

        {/* Caption */}
        <p className="mt-4 text-center font-sans text-[0.72rem] uppercase tracking-[0.15em] text-[var(--text-dim)]">
          In any game · Your tabs · Browse &amp; watch · Resize · Focus mode
        </p>
      </div>
    </section>
  )
}

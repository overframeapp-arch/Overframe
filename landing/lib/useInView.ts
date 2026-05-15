'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Lightweight IntersectionObserver hook for scroll-triggered reveal animations.
 * Once the element enters the viewport the observer disconnects — no repeated
 * toggling. Pair with `.reveal` / `.in-view` CSS classes.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px', ...options },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return [ref, inView] as const
}

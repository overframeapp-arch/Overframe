import { useState, useCallback } from 'react'

export interface VisibleGame {
  processName: string
  exePath: string
  displayName: string
  /** Main window title — often the clean game name when PE metadata (displayName) is absent. */
  windowTitle: string
  /** PNG data URL of the window's taskbar icon, or '' if unavailable. */
  iconDataUrl: string
  /** True when the window covers an entire display — strong signal this is the game being played. */
  isFullscreen: boolean
}

export interface UseGameDetectReturn {
  visibleGames: VisibleGame[]
  showPicker: boolean
  detectLoading: boolean
  detect: () => Promise<void>
  closePicker: () => void
  pickGame: (game: VisibleGame, currentNames: string) => string
}

export function useGameDetect(): UseGameDetectReturn {
  const [visibleGames, setVisibleGames] = useState<VisibleGame[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [detectLoading, setDetectLoading] = useState(false)

  const detect = useCallback(async (): Promise<void> => {
    setDetectLoading(true)
    setShowPicker(false)
    try {
      const games = await window.aether.profiles.getVisibleGames()
      setVisibleGames(games)
      setShowPicker(true)
    } finally {
      setDetectLoading(false)
    }
  }, [])

  const closePicker = useCallback((): void => setShowPicker(false), [])

  /**
   * Appends a picked game's processName to the existing comma-separated list.
   * Returns the updated string. Name de-duplication is case-insensitive.
   */
  const pickGame = useCallback((game: VisibleGame, currentNames: string): string => {
    const current = currentNames.split(',').map((s) => s.trim()).filter(Boolean)
    const key = game.processName.toLowerCase()
    if (current.map((c) => c.toLowerCase()).includes(key)) return currentNames
    setShowPicker(false)
    return [...current, key].join(', ')
  }, [])

  return { visibleGames, showPicker, detectLoading, detect, closePicker, pickGame }
}

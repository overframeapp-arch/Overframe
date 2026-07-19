import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { CollectionExport } from '@shared/types'
import { useMissionsStore } from '../store/missionsStore'

/**
 * Share/export + import flows for collections — the product's core virality
 * feature. Single implementation consumed by both CollectionsPanel (popup) and
 * ManagePanel (welcome page) so the two surfaces cannot diverge on clipboard
 * behaviour, share-code preview, mission completion, or error feedback.
 */

/**
 * Copy a collection's share code to the clipboard, with the floating "Copied"
 * feedback anchored at the user's last click.
 *
 * Uses a window `pointerdown` listener (one event per click) rather than
 * tracking `mousemove` continuously — the toast only needs the position of the
 * click that triggered the export.
 */
export function useShareCollection(): {
  copiedPos: { x: number; y: number } | null
  shareToClipboard: (id: string) => Promise<void>
} {
  const { complete } = useMissionsStore()
  const [copiedPos, setCopiedPos] = useState<{ x: number; y: number } | null>(null)
  const lastPointerPos = useRef({ x: 0, y: 0 })
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const h = (e: PointerEvent): void => { lastPointerPos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointerdown', h)
    return () => {
      window.removeEventListener('pointerdown', h)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  const shareToClipboard = async (id: string): Promise<void> => {
    // Try the short code first (requires network + deployed share worker);
    // fall back to the raw export payload.
    const code = await window.aether.collections.share(id)
    const textToCopy = code ?? (await window.aether.collections.export(id))
    if (!textToCopy) return
    complete('export-collection')
    setCopiedPos(lastPointerPos.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setCopiedPos(null), 2000)
    try { await navigator.clipboard.writeText(textToCopy) } catch { /* clipboard may fail if window loses focus */ }
  }

  return { copiedPos, shareToClipboard }
}

/**
 * Paste-code → preview → confirm import state machine.
 * Panel-specific visibility state (which profile/form is open) stays in the
 * panel; everything about decoding, previewing and persisting lives here.
 */
export function useImportCollection(onImported: () => Promise<void> | void): {
  importValue: string
  setImportValue: (v: string) => void
  importPreview: CollectionExport | null
  importError: boolean
  importing: boolean
  importAddRef: RefObject<HTMLButtonElement>
  previewImport: () => Promise<void>
  confirmImport: (profileId: string) => Promise<void>
  reset: () => void
} {
  const { complete } = useMissionsStore()
  const [importValue, setImportValue] = useState('')
  const [importPreview, setImportPreview] = useState<CollectionExport | null>(null)
  const [importError, setImportError] = useState(false)
  const [importing, setImporting] = useState(false)
  const importAddRef = useRef<HTMLButtonElement>(null)

  // Move focus to the confirm CTA once a preview is shown.
  useEffect(() => {
    if (importPreview) importAddRef.current?.focus()
  }, [importPreview])

  const reset = (): void => {
    setImportValue('')
    setImportPreview(null)
    setImportError(false)
  }

  /** Decode + sanitize the pasted code into a preview (no persistence yet). */
  const previewImport = async (): Promise<void> => {
    const code = importValue.trim()
    if (!code) return
    setImportError(false)
    const preview = await window.aether.collections.previewImport(code)
    if (preview) setImportPreview(preview)
    else setImportError(true)
  }

  /** Confirm: actually import the previewed payload into the given profile. */
  const confirmImport = async (profileId: string): Promise<void> => {
    if (!importValue.trim() || importing) return
    setImporting(true)
    try {
      await window.aether.collections.import(importValue.trim(), profileId)
      // The 'export-collection' mission covers both directions ("Export a
      // collection as a link to share it, or import one someone shared with you").
      complete('export-collection')
      reset()
      await onImported()
    } finally {
      setImporting(false)
    }
  }

  return { importValue, setImportValue, importPreview, importError, importing, importAddRef, previewImport, confirmImport, reset }
}

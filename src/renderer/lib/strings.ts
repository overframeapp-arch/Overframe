// Centralised user-facing strings — single source of truth for labels, messages, and copy.

export const STRINGS = {
  // ── Toasts / notifications ───────────────────────────────────────────────
  toast: {
    profileCreated: 'Profile created: ',
    profileActivated: 'Profile activated: ',
  },

  // ── Errors ───────────────────────────────────────────────────────────────
  errors: {
    bookmarkSaveFailed: 'Failed to save bookmark.',
    bookmarkRemoveFailed: 'Failed to remove bookmark.',
    rendererCrashed: 'The interface crashed. Click to reload.',
  },
} as const

import type { AetherAPI } from '../preload'

declare global {
  interface Window {
    aether: AetherAPI
  }
}

export {}

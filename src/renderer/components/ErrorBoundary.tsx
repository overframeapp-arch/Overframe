import { Component, type ReactNode } from 'react'
import { STRINGS } from '../lib/strings'

interface Props {
  children: ReactNode
  /** Optional fallback override. Receives the caught error. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

// Catches render errors so a single broken component doesn't blank the whole overlay.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log to main process via console (electron forwards stderr to its log)
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div
          role="alert"
          className="fixed inset-3 flex items-center justify-center bg-background/95 border border-destructive/40 rounded-md p-4 z-50"
        >
          <div className="flex flex-col items-center gap-2 text-center max-w-xs">
            <p className="text-[12px] text-destructive font-medium">
              {STRINGS.errors.rendererCrashed}
            </p>
            <p className="text-[10px] text-muted-foreground break-all">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 h-7 px-3 rounded text-[11px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

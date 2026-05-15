import { useAppStore } from '../store/appStore'

export function PinnedBar(): JSX.Element | null {
  const { collections, activeProfile } = useAppStore()
  if (!activeProfile) return null

  const visible = collections.filter(
    (c) => c.profileId === activeProfile.id || c.profileId === 'shared'
  )
  const pinned = visible
    .flatMap((c) => c.links.filter((l) => l.pinned).map((l) => ({ collection: c, link: l })))
    .slice(0, 8)

  if (pinned.length === 0) return null

  return (
    <div className="no-drag flex items-center gap-0.5 px-1.5 h-7 bg-muted border-b border-border overflow-x-auto">
      {pinned.map(({ link }) => (
        <button
          type="button"
          key={link.id}
          aria-label={link.title || link.url}
          onClick={() => void window.aether.tabs.create(link.url)}
          className="flex items-center gap-1.5 h-6 px-2.5 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors shrink-0 max-w-[150px]"
          title={link.url}
        >
          {link.favicon ? (
            <img src={link.favicon} alt="" className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <div className="h-3.5 w-3.5 shrink-0 rounded-sm bg-muted-foreground/20" />
          )}
          <span className="truncate">{link.title}</span>
        </button>
      ))}
    </div>
  )
}

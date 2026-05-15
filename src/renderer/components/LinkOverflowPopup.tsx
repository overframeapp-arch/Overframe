import type { LinkOverflowPayload } from '@shared/types'
import { Favicon } from './collections/atoms'

interface Props {
  data: LinkOverflowPayload
}

export function LinkOverflowPopup({ data }: Props): JSX.Element {
  const handleClick = (url: string): void => {
    void window.aether.tabs.create(url)
    window.aether.popup.close()
  }

  return (
    <div className="h-full bg-background border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col">
      <ul className="flex-1 overflow-y-auto py-0.5" role="list" aria-label="More links">
        {data.links.map((link) => (
          <li key={link.id}>
            <button
              type="button"
              onClick={() => handleClick(link.url)}
              title={link.url}
              aria-label={link.title || link.url}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-muted transition-colors cursor-default select-none outline-none focus-visible:bg-muted"
            >
              {link.favicon ? (
                <img src={link.favicon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" />
              ) : (
                <Favicon url={link.url} favicon={link.favicon} />
              )}
              <span className="truncate">{link.title || link.url}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

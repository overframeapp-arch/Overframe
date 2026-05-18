import { useEffect, useState } from 'react'

const DEFAULT_PROFILE_ID = 'default'

/** Normalize and allow only safe icon URL forms to prevent scriptable URL injection. */
function sanitizeIconUrl(url: string): string | undefined {
  const value = url.trim()
  if (!value) return undefined

  // Allow only explicit relative paths.
  if (/^(\/|\.\/|\.\.\/)/.test(value)) return value

  // Allow only image data URLs.
  if (/^data:/i.test(value)) return /^data:image\//i.test(value) ? value : undefined

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:', 'file:', 'blob:'].includes(parsed.protocol)) return undefined
    return parsed.href
  } catch {
    return undefined
  }
}

export function ProfileIcon({
  iconUrl,
  name,
  size = 16,
  profileId,
}: {
  iconUrl?: string
  name: string
  size?: number
  profileId?: string
}): JSX.Element {
  const [err, setErr] = useState(false)
  // Reset the error flag whenever the source URL changes — otherwise a profile
  // whose icon is later updated would stay stuck on the fallback initial.
  useEffect(() => { setErr(false) }, [iconUrl])
  const safeIconUrl = iconUrl ? sanitizeIconUrl(iconUrl) : undefined
  const src = safeIconUrl && !err ? safeIconUrl : (profileId === DEFAULT_PROFILE_ID ? './icons/icon.svg' : null)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size }}
        className="rounded-sm object-contain shrink-0"
      />
    )
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      className="rounded-sm bg-muted flex items-center justify-center text-muted-foreground font-semibold shrink-0 select-none"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

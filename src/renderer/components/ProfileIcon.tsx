import { useEffect, useState } from 'react'

const DEFAULT_PROFILE_ID = 'default'

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
  const src = iconUrl && !err ? iconUrl : (profileId === DEFAULT_PROFILE_ID ? './icons/icon.svg' : null)
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

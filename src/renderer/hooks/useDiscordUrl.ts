import { useMissionsStore } from '../store/missionsStore'
import { DISCORD_INVITE_URL, DISCORD_CHANNEL_URL } from '../lib/missions'

/** Returns the Discord URL appropriate for the user's join status.
 *  Before joining: invite link. After joining (mission complete): announcements channel. */
export function useDiscordUrl(): string {
  const joined = useMissionsStore((s) => s.completed.includes('join-discord'))
  return joined ? DISCORD_CHANNEL_URL : DISCORD_INVITE_URL
}

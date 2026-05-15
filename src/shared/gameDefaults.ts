/**
 * Built-in defaults surfaced to the renderer so Settings panels can show
 * what's already active before the user adds anything.
 *
 * These values mirror the hardcoded constants in main/managers/profiles/heuristics.ts.
 * Keep them in sync if heuristics ever change.
 *
 * Zero Node/Electron imports — safe for renderer use.
 */

/** Path fragments that are always excluded from game-install detection. */
export const DEFAULT_NON_GAME_DIRS: readonly string[] = [
  '\\program files\\',
  '\\program files (x86)\\',
  '\\programdata\\',
  '\\appdata\\local\\',
  '\\appdata\\roaming\\',
]

/**
 * Full list of process names that are blocked by default — mirrors the
 * hardcoded NON_GAME_BLOCKLIST in heuristics.ts (minus 'electron' / 'overframe'
 * which are self-protection constants never exposed to the user).
 *
 * The user owns this list entirely via the `blockedProcesses` setting.
 */
export const DEFAULT_BLOCKED_PROCESSES: readonly string[] = [
  // Browsers
  'msedge', 'chrome', 'firefox', 'brave', 'opera', 'vivaldi', 'waterfox', 'librewolf',
  // Communication
  'discord', 'slack', 'teams', 'zoom', 'skype', 'telegram', 'signal',
  // Streaming / recording
  'obs64', 'obs32', 'obs', 'xsplit.core',
  // Stores / launchers
  'steam', 'steamwebhelper', 'steamservice',
  'epicgameslauncher', 'epicwebhelper',
  'galaxyclient', 'galaxyupdater',
  'eadesktop', 'eabackgroundservice', 'eacefsubprocess', 'origin', 'originclientservice',
  'battlenet', 'battle.net',
  'ubisoft connect', 'uplay_launcher', 'uplaywebcore', 'ubisoftgamelauncherplugin',
  'riotclientux', 'riotclientservices', 'riotclientcrashhandler', 'riotgamespatcher',
  'rockstarlauncher',
  'amazongamesui',
  'itch', 'itchio',
  'playnite', 'playnite.fullscreenapp',
  'gamesplanetlauncher', 'indiegalauncherclient',
  'xboxapplication', 'xboxapp', 'microsoftstoreapp',
  'twitch', 'minigalaxy',
  // System / Windows
  'explorer', 'taskmgr', 'mmc', 'regedit', 'controlpanel',
  'settingshandler_x64', 'systemsettings',
  // IDEs / editors
  'code', 'devenv', 'rider64', 'rider', 'idea64', 'idea', 'webstorm64', 'webstorm',
  'cursor', 'windsurf', 'notepad', 'notepad++',
  // Terminals
  'windowsterminal', 'wt', 'cmd', 'conhost', 'powershell', 'pwsh',
  // Media
  'vlc', 'mpv', 'mpc-hc64', 'mpc-hc', 'potplayer64', 'potplayermini64',
  'spotify', 'groove music',
  // Desktop / peripherals
  'wallpaper32', 'wallpaper64', 'rainmeter',
  'lghub', 'lghub_agent', 'lghub_system_tray',
  'streamdeck', 'voicemeeter', 'voicemeeterremote64',
]

/**
 * Path fragments used to identify game installs from known stores.
 * The user can edit this list freely — remove an entry to stop detecting
 * games from that store, or add custom fragments for unlisted stores.
 */
export const DEFAULT_GAME_PATH_HINTS: readonly string[] = [
  '\\steamapps\\',
  '\\epic games\\',
  '\\gog galaxy\\games\\',
  '\\gogcom\\',
  '\\riot games\\',
  '\\ubisoft game launcher\\games\\',
  '\\ubisoft\\games\\',
  '\\ea games\\',
  '\\electronic arts\\',
  '\\origin games\\',
  '\\battle.net\\',
  '\\blizzard entertainment\\',
  '\\bethesda.net launcher\\',
  '\\xboxgames\\',
  '\\xbox games\\',
  '\\microsoft games\\',
  '\\amazon games\\',
  '\\itch\\',
  '\\rockstar games\\',
  '\\2k games\\',
  '\\square enix\\',
  '\\activision\\',
  '\\paradox interactive\\',
  '\\sega\\',
  '\\ncsoft\\',
  '\\ncwest\\',
  '\\gaijin\\',
  '\\wargaming.net\\',
  '\\deep silver\\',
  '\\thq nordic\\',
  '\\cd projekt red\\',
  '\\humble\\',
]


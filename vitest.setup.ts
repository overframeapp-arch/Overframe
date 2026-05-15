import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => process.cwd()),
    isPackaged: false,
    getVersion: vi.fn(() => '0.0.0-test'),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: vi.fn(),
  WebContentsView: vi.fn(),
  session: { defaultSession: { webRequest: { onBeforeRequest: vi.fn() } } },
  screen: { getPrimaryDisplay: vi.fn(() => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })) },
  dialog: { showOpenDialog: vi.fn() },
}))

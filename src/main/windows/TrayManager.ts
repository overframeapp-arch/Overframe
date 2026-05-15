import { Tray, Menu, app, nativeImage } from 'electron'
import path from 'node:path'
import type { OverlayWindow } from '../windows/OverlayWindow'
import type { ProfileManager } from '../managers/ProfileManager'

export class TrayManager {
  private tray: Tray | null = null
  private unsubProfileChange: (() => void) | null = null

  constructor(
    private overlay: OverlayWindow,
    private profiles: ProfileManager
  ) {}

  init(): void {
    const iconPath = this.resolveIconPath()
    let img = nativeImage.createFromPath(iconPath)
    if (img.isEmpty()) {
      // Fallback: create a tiny transparent icon to avoid crash on missing file.
      img = nativeImage.createEmpty()
    }

    this.tray = new Tray(img)
    this.refreshMenu()
    this.tray.setToolTip(`Overframe — ${this.profiles.getActive().name}`)
    this.tray.on('double-click', () => this.overlay.toggle())

    this.unsubProfileChange = this.profiles.onChange((p) => {
      if (this.tray) this.tray.setToolTip(`Overframe — ${p.name}`)
      this.refreshMenu()
    })
  }

  private refreshMenu(): void {
    if (!this.tray) return
    const active = this.profiles.getActive()
    const menu = Menu.buildFromTemplate([
      { label: `Profile: ${active.name}`, enabled: false },
      { type: 'separator' },
      { label: 'Show / Hide overlay', click: () => this.overlay.toggle() },
      { type: 'separator' },
      {
        label: 'Quit Overframe',
        click: () => {
          app.quit()
        }
      }
    ])
    this.tray.setContextMenu(menu)
  }

  private resolveIconPath(): string {
    const isDev = !app.isPackaged
    if (isDev) {
      return path.join(process.cwd(), 'public', 'icons', 'tray.png')
    }
    return path.join(process.resourcesPath, 'icons', 'tray.png')
  }

  showBalloon(title: string, content: string): void {
    this.tray?.displayBalloon({ title, content, iconType: 'none', noSound: false })
  }

  dispose(): void {
    this.unsubProfileChange?.()
    this.unsubProfileChange = null
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

const config = {
  outDir: 'dist',
  packagerConfig: {
    name: 'Overframe',
    executableName: 'overframe',
    appBundleId: 'app.overframe',
    asar: true,
    icon: 'public/icons/icon',
    extraResource: ['public/icons'],
    ignore: [
      /^\/src($|\/)/,
      /^\/scripts($|\/)/,
      /^\/docs($|\/)/,
      /^\/public($|\/)/,
      /^\/coverage($|\/)/,
      /^\/\.vscode($|\/)/,
      /^\/\.github($|\/)/,
      /^\/\.git($|\/)/,
      /^\/electron\.vite\.config\..*/,
      /^\/forge\.config\..*/,
      /^\/postcss\.config\..*/,
      /^\/tailwind\.config\..*/,
      /^\/tsconfig.*/,
      /^\/\.npmrc$/,
      /^\/\.gitignore$/,
      /^\/README\.md$/,
      /^\/pnpm-lock\.yaml$/
    ],
    win32metadata: {
      ProductName: 'Overframe',
      CompanyName: 'Overframe',
      FileDescription: 'A lightweight web overlay browser for gamers'
    }
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'overframe',
      setupExe: 'Overframe-Setup.exe',
      setupIcon: 'public/icons/icon.ico',
      loadingGif: 'public/icons/loading.gif',
      noMsi: true,
    }),
    new MakerZIP({}, ['win32'])
  ],
  plugins: [new AutoUnpackNativesPlugin({})]
}

export default config

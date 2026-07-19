import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerAppX } from '@electron-forge/maker-appx'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'

const config = {
  outDir: 'dist',
  packagerConfig: {
    name: 'Overframe',
    executableName: 'overframe',
    appBundleId: 'app.overframe',
    appCopyright: `Copyright © ${new Date().getFullYear()} Overframe`,
    asar: true,
    icon: 'public/icons/icon',
    // Ship the compiled WebView2 addon as a plain resource (not inside the asar).
    // WebView2View.ts resolves it at process.resourcesPath/webview2_addon.node in
    // packaged builds — this copies it exactly there. The rest of native/ (C++
    // source + the 60k-line vendored SDK header + import lib) is excluded below.
    extraResource: ['public/icons', 'native/webview2-addon/build/Release/webview2_addon.node'],
    ignore: [
      /^\/src($|\/)/,
      /^\/native($|\/)/,
      /^\/scripts($|\/)/,
      /^\/docs($|\/)/,
      /^\/public($|\/)/,
      /^\/coverage($|\/)/,
      /^\/dist($|\/)/,
      /^\/landing($|\/)/,
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
      /^\/pnpm-lock\.yaml$/,
    ],
    win32metadata: {
      ProductName: 'Overframe',
      CompanyName: 'Overframe',
      FileDescription: 'A lightweight web overlay browser for gamers',
      OriginalFilename: 'overframe.exe',
    },
  },
  rebuildConfig: {},
  makers: [
    // Squirrel package name MUST be a single token, no spaces — this drives the
    // NuGet package id and the install-folder name (%LOCALAPPDATA%\Overframe).
    new MakerSquirrel({
      name: 'Overframe',
      authors: 'Overframe',
      description: 'A lightweight web overlay browser for gamers.',
      exe: 'overframe.exe',
      setupExe: 'Overframe-Setup.exe',
      setupIcon: 'public/icons/icon.ico',
      iconUrl:
        'https://raw.githubusercontent.com/overframeApp-arch/Overframe/main/public/icons/icon.ico',
      loadingGif: 'public/icons/loading.gif',
      noMsi: true,
    }),
    new MakerZIP({}, ['win32']),
    // Microsoft Store submission (MSIX route — the Store signs the package
    // during ingestion, so no code-signing certificate is needed on our side).
    // Identity values reserved in Partner Center (see docs/store/listing.md).
    new MakerAppX({
      packageName: 'Overframe.Overframe',
      publisher: 'CN=A805C199-2F71-4C15-8CEE-70CC53BA0A3B',
      packageDisplayName: 'Overframe',
      packageDescription: 'A lightweight web overlay browser for gamers.',
      packageExecutable: 'app\\overframe.exe',
    }),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
}

export default config

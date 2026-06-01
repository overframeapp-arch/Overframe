import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Allowlist: the unit-testable business-logic surface only.
      //
      // Electron-window classes, native bindings (koffi/uiohook), IPC wiring and
      // React components are intentionally EXCLUDED — driving them to 100% means
      // testing mocks, not behaviour. They are guarded by `tsc` + manual/E2E
      // validation (WORKFLOW.md §4). The 100% threshold below is meaningful
      // precisely because it only covers code that can break silently in logic.
      include: [
        'src/main/managers/CollectionsManager.ts',
        'src/main/managers/SessionManager.ts',
        'src/main/managers/profiles/heuristics.ts',
        'src/main/store/index.ts',
        'src/main/lifecycle/shortcutActions.ts',
        'src/renderer/lib/url.ts',
        'src/renderer/lib/strings.ts',
        'src/renderer/lib/cn.ts',
        'src/renderer/lib/notify.ts',
        'src/renderer/lib/a11y.ts',
        'src/renderer/lib/missions.ts',
        'src/renderer/store/appStore.ts',
        'src/renderer/store/missionsStore.ts',
        'src/shared/gameDefaults.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})

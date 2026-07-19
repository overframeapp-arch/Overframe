# TASKS — Overframe

> **Pour Claude :** Lis ce fichier en début de session pour savoir où en est le projet et quoi faire ensuite.
> Mets-le à jour en fin de session : déplace les tâches terminées dans "Done", ajuste les priorités.
> Ne modifie pas la section "Contraintes" sans accord explicite.

---

## État actuel du projet

**Version en cours :** v0.2.0 **PUBLIÉE** (2026-07-19) → cap sur v1.0
**Branche active :** `dev`
**Dernière session :** 2026-07-19 — **Release v0.2.0 publiée** (53 commits depuis v0.1.0) : merge dev→main (PR #60), tag, workflow Release vert, notes de release soignées (CHANGELOG.md). Avant le tag : signalisation d'update ajoutée (updater branché au boot + notification Windows), validation IPC complète (PR #57, revue security-reviewer GO), CI/Release épinglées windows-2022, vitest 3.2.7. Les utilisateurs v0.1.0 recevront la mise à jour automatiquement à leur prochain redémarrage.
**Suite (même session) :** Chantier Microsoft Store lancé — compte Partner Center créé, identité produit réservée, `MakerAppX` configuré et **build MSIX réel vérifié** (`overframe.appx`, 179 Mo, signé par un certificat de dev auto-généré). Reste : questionnaire IARC, icônes Store personnalisées (placeholders par défaut pour l'instant), captures d'écran, puis soumission.

Le cœur du produit est fonctionnel : overlay, tabs, profils, collections, sessions, raccourcis globaux, tray, auto-update, onboarding. L'objectif immédiat est de solidifier pour la release publique v1.0.

---

## En cours

_(vide — à remplir par Claude au début d'une session de travail)_

---

## Priorité haute — Chemin vers v1.0

### Qualité & robustesse
- [ ] **[BUG] Adblock mort — uBlock Origin (MV2) tué par WebView2 150 — reste à remplacer** — le runtime WebView2 Evergreen (Chromium/Edge 150) a définitivement retiré Manifest V2 (fin juin 2026) ; uBlock 1.71 est MV2. `AddBrowserExtension`/`Enable` répondent "succès", zéro erreur, mais rien ne s'installe ni ne filtre. Probe du 2026-07-18 dans un onglet réel : `googlesyndication`/`doubleclick`/`GTM`/`GA` chargent (pubs NON bloquées) ; `fbevents`/TikTok bloqués par la **tracking prevention intégrée d'Edge** (toujours active — d'où l'impression utilisateur "pas de pub"). Fait : toggle Settings désactivé avec explication honnête (2026-07-18). Pistes de remplacement : uBlock Origin Lite (MV3 — vérifier support WebView2), niveau de tracking prevention via `ICoreWebView2Profile3`, ou filtrage `WebResourceRequested`.
- [ ] **[SEC] `check:deps` rouge sur koffi — trancher** — le script interdit les bindings natifs "hooks/injection", mais koffi ne sert ici qu'à des appels Win32 en lecture seule pour la détection de jeu (`getExeProductName`, `getVisibleGames`, `getWindowIcon`) — pas d'injection (uiohook, déjà accepté, est plus intrusif). Décision : allowlister koffi avec justification dans le script, ou remplacer par un mini-addon dédié. En attendant, `pnpm check:deps` échoue.
- [ ] **[QA] Findings mineurs qa-tester (2026-07-18)** — `setIconUrl`/`create` sans sanitisation interne (l'IPC valide déjà — défense en profondeur), import de `sections: ['', ' ']` produit `sections: []` (active le mode sections à tort), `moveLink` avec id inconnu persiste quand même (bump `updatedAt`).
- [ ] **[VALID HUMAIN] [FEAT] WebView2 — test réel Google + Cloudflare** — vérifier un vrai login Google et un site Cloudflare-protégé (Turnstile inclus) dans un onglet Overframe. Les onglets sont désormais rendus par Edge WebView2 (vrai navigateur), donc plus de spoofing `navigator.userAgentData` : l'ancien résiduel Electron est levé. Vérifier aussi `pnpm make` (addon packagé en `extraResource`).
- [ ] **[PERF] RAM au boot ~310 MB > budget 300** — détecté par `pnpm smoke` le 2026-06-01 (overlay FOCUSED / welcome au lancement). Lancer le subagent `perf-auditor`, isoler la cause (welcome page ? WebContentsView retenue ?), consigner avant/après. NB : la RAM observée varie fortement run-à-run (122–310 MB) — mesurer plusieurs fois.
- [ ] **[PERF] Audit performance** : `curl http://127.0.0.1:9119/metrics` idle + 3 onglets. Corriger si hors budget (< 150 MB idle, < 300 MB actif). Consigner avant/après chiffrés dans DEVLOG. Guide : `.claude/guides/PERFORMANCE.md`
- [ ] **[FIX] Multi-monitor** : vérifier que la fenêtre se souvient du bon écran après un changement de configuration moniteurs.
- [ ] **[FIX] Gestion d'erreur page load** : affiner l'état "failed to load" dans les WebContentsViews (réseau coupé, SSL invalide). Ajouter test de régression.

### UX & polish
- [ ] **Context menu** dans les WebContentsViews : right-click → copier, coller, ouvrir dans un nouvel onglet, inspecter.
- [ ] **Vérifier l'onboarding flow** : parcourir le OnboardingOverlay complet, valider chaque étape, tester sur une installation fraîche (devStoreReset).

### Release
- [ ] **README — GIF de démo** : enregistrer l'overlay en action sur un vrai jeu (tâche humaine — captures statiques faites le 2026-07-18).
- [ ] **[VALID HUMAIN] Installation réelle** : dérouler `Overframe-Setup.exe` (produit le 2026-07-18) sur machine propre — pas de droits admin demandés, app démarre, tray OK.
- [ ] **[CHORE] Dégraisser le package** : l'installeur pèse 169 MB ; `app.asar.unpacked` embarque un dossier parasite `@rollup/rollup-win32-x64-msvc_tmp_*` (outil de build) — auditer les exclusions electron-forge.

---

## Priorité normale — Backlog post-v1.0

| Priorité | Feature | Version cible |
|---|---|---|
| ★★★ | Ad blocker intégré (uBlock-style filter lists) | v1.1 |
| ★★★ | Collection sharing via lien (infrastructure serveur) | v1.1 |
| ★★☆ | Ctrl+F recherche dans la page courante | v1.2 |
| ★★☆ | Picture-in-Picture mode (vue compacte) | v1.2 |
| ★☆☆ | Cloud sync collections + profils (tier payant) | v1.3 |
| ★☆☆ | CSS custom par site (nettoyage wikis) | v1.4 |
| ★☆☆ | Code signing certificate | v1.5 |

---

## Done — Récent

- [x] **[SEC] Validation inputs IPC collections + profiles** (2026-07-18) — `isId` sur tous les ids, coercitions `String()` supprimées (title/name/iconUrl stockaient des valeurs brutes non-string), patch `ProfilesUpdate` whitelisté + `opacity`/`windowBounds` bornés, `mode`/`profileId`/`source`/`favicon`/`pinned` validés, tableaux reorder bornés. Revue `security-reviewer` : GO, tous findings traités. Sanity en app réelle : tous les flux légitimes passent.
- [x] **[FIX] Smoke refuse un port 9119 occupé** (2026-07-18) — fail-fast avec message clair au lieu de mesurer silencieusement l'instance pré-existante
- [x] **[RELEASE] `pnpm make` validé** (2026-07-18) — `Overframe-Setup.exe` + nupkg + zip produits, addon WebView2 présent en `extraResource`, natifs unpacked OK
- [x] **[RELEASE] README release-ready** (2026-07-18) — captures (home, collections), FAQ (SmartScreen, anti-cheat, borderless, adblock, données locales), tech stack corrigée (WebView2)
- [x] **Raccourci Ctrl+L** — déjà implémenté (App.tsx, handler DOM) ; la tâche était périmée
- [x] **[FIX] Smoke flaky sur `/overlay/show`** (2026-07-18) — poll-until (3 s max, pas de sleep fixe) sur show ET hide ; ALL PASS ×3 consécutifs
- [x] **[BUG court terme] Toggle adblock honnête** (2026-07-18) — case désactivée + bandeau explicatif en langage simple dans Settings → Browser (vérifié visuellement)
- [x] **[TEST] Couverture 100% restaurée après le WIP bannerFocus** (2026-07-18) — +24 tests (CollectionsManager sections/moveLink/sanitizeFocus, backfill quickLinks, appStore.setHomeTab) via qa-tester
- [x] **[FIX] `updateLink` accepte `section: null`** (2026-07-18) — le widening voulu était annulé par le Pick ; section exclue du spread
- [x] **[FIX] `migrateStore` survit à une entrée `null` dans quickLinks** (2026-07-18) — garde + test de régression
- [x] **[DIAG] Attribution IG — adblock in-app hors de cause** (2026-07-18) — igr= survit, profil persistant ; vrais suspects : achats même compte/machine (confirmé par le support IG), tag absent ; re-tester avec de vrais utilisateurs post-release
- [x] **[FEAT] Compatibilité navigateur standard (Google, Cloudflare)** (2026-06-01) — `feat/browser-compat`
  - Google login : UA Firefox + Sec-Fetch-* cohérents + identité JS complète (userAgent, productSub, oscpu, buildID, plugins:0, chrome:undefined) + auto-retry sur /rejected (clear cookies AEC + redir /signin/identifier)
  - Cloudflare navigation générale : UA Chrome propre + Sec-CH-UA alignés + userAgentData "Google Chrome" + webdriver:false + chrome.loadTimes/csi/runtime corrects + Function.prototype.toString native
  - `src/shared/userAgent.ts` + `src/preload/tabStealth.ts` + `TabManager` onBeforeSendHeaders + `index.ts` disable-blink-features
  - 162 tests, 100% coverage ; typecheck + lint verts
  - **Cloudflare Turnstile OAuth** (poe.ninja, filterblade) : incompatibilité plateforme WebContentsView documentée dans SECURITY.md — solution future : shell.openExternal
- [x] **Durcissement méthode — chaque axe ≥9/10** (2026-06-01)
  - Garde-fous : egress hors-localhost + `node -e` bloqués, permissions scopées
  - `SessionStart` hook (boot avec branche+TASKS+DEVLOG) ; routage auto des guides métier
  - 4 subagents (`security-reviewer`/`qa-tester`/`perf-auditor`/`a11y-reviewer`) + commands `/review-security` `/cover` `/ship`
  - **Smoke produit** `pnpm smoke` (lance la vraie app, vérifie overlay/screenshot/RAM) — ALL PASS
  - `postinstall` installe le pre-commit ; job CI `build-windows` (natif)
- [x] **Audit méthode + couverture logique métier à 100%** (2026-06-01)
  - Hooks réparés : feedback ESLint réellement remonté à Claude (`additionalContext`), `--max-warnings 0`
  - Garde-fou `PreToolUse` : bloque push main / force-push / reset --hard / clean -f / --no-verify / npm add
  - Setup d'autonomie enfin commité **et poussé** sur `origin/chore/claude-setup`
  - 147 tests, **100% stmts/branches/funcs/lines** sur l'allowlist logique (`vitest.config.ts`) + gate 100% en CI
  - Couvre : `[TEST] CollectionsManager` (CRUD + export/import Base64) et `[TEST] SessionManager` (save/restore/autosave)
- [x] Setup autonomie Claude : CLAUDE.md, devLogger, devServer, hooks, DEVLOG, TASKS (2026-05-29)
- [x] Core overlay + états (HIDDEN / FOCUSED / CLICK_THROUGH)
- [x] TabManager + WebContentsViews multi-onglets
- [x] ProfileManager + détection de jeu par polling processus
- [x] CollectionsManager + SessionManager
- [x] ShortcutManager + uiohook (WH_KEYBOARD_LL)
- [x] TrayManager
- [x] Settings panel
- [x] Onboarding + WelcomePage
- [x] MissionsTracker / Achievements
- [x] Auto-updater (GitHub Releases)
- [x] Crash logger

---

## Contraintes permanentes

- **Windows only** — pas de code macOS/Linux tant que la v1.0 n'est pas sortie
- **Zéro dépendance npm** sans accord explicite — auditer avec `pnpm check:deps`
- **Tout code dev-only** doit être gardé par `!app.isPackaged`
- **Tout canal IPC** doit être déclaré dans `src/shared/ipc.ts` avant usage
- **Pas de push direct sur `main`** — toujours passer par une PR depuis `dev`
- **`pnpm typecheck && pnpm lint`** doit passer avant tout commit

---

## Comment utiliser ce fichier (pour Claude)

1. **En début de session** : lis "État actuel" + "En cours" + "Priorité haute" pour choisir ta tâche.
2. **Pendant la session** : déplace la tâche choisie dans "En cours".
3. **En fin de session** : déplace les tâches terminées dans "Done", mets à jour "État actuel", note la date.
4. **Si tu trouves un bug** : ajoute-le en haut de "Priorité haute" avec le tag `[BUG]`.
5. **Si une tâche bloque** : note le blocage en commentaire sur la ligne, ne la supprime pas.

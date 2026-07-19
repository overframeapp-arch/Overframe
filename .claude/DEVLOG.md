# Overframe — Dev Log (Fil Rouge Claude)

Ce fichier est tenu à jour par Claude à chaque session de travail.
Il sert de mémoire vive du projet : ce qui a été fait, pourquoi, ce qui reste, et les questions ouvertes.
Le hook `SessionStart` injecte automatiquement la **dernière** entrée (titre + Prochaine étape) au démarrage.

> **Compaction :** au-delà de ~15 entrées, archiver les plus anciennes dans `.claude/devlog-archive/AAAA-Qn.md`
> et ne garder ici que les ~10 dernières + un résumé d'une ligne par session archivée. Évite que le fil rouge
> devienne illisible (et coûteux en contexte).

---

## Format d'entrée

```
## [YYYY-MM-DD] Titre de la session

**Contexte :** Pourquoi ce travail a été lancé.
**Fichiers modifiés :**
- `chemin/fichier.ts` — ce qui a changé et pourquoi
**Observations :** Ce qui a été vu, testé, constaté.
**Décisions :** Choix importants et leur justification.
**Questions ouvertes :** Ce qui n'est pas tranché ou mérite attention.
**Prochaine étape :** Ce qui doit logiquement suivre.
```

---

## [2026-07-18] [DIAG+FIX] Attribution IG, mort de l'adblock (MV2), couverture 100%, smoke stable

**Contexte :** L'utilisateur a validé un plan revenu v1.0 (release → distribution passive → attribution IG → loadouts). Premier chantier : diagnostiquer pourquoi les commissions IG ne tombent pas, puis solidifier la branche pour le merge.

**Fichiers modifiés :**
- `scripts/smoke.mjs` — poll-until (3 s) au lieu des sleeps fixes sur show/hide ; le flaky 1-run-sur-2 ne se reproduit plus (ALL PASS ×3)
- `SettingsPanel.tsx` — toggle adblock désactivé + bandeau honnête (l'adblock ne fonctionne plus, voir Observations)
- `CollectionsManager.ts` — `updateLink` accepte `{ section: null }` (fix de signature + section exclue du spread)
- `store/index.ts` — garde `l ?? {}` dans le backfill quickLinks (une entrée `null` faisait planter la migration)
- Tests : +24 (CollectionsManager +19, store/index +3 dont régression null, appStore +1) — gate 100/100/100/100 restauré après le WIP bannerFocus

**Observations :**
- **Adblock mort silencieusement** : WebView2 Evergreen auto-mis à jour vers Edge/Chromium 150, qui a retiré Manifest V2 définitivement (fin juin 2026). uBlock 1.71 (MV2) : Add/Enable "succès" mais zéro fichier installé, zéro filtrage. Probe onglet réel : googlesyndication/doubleclick/GTM/GA chargent ; fbevents/TikTok bloqués par la tracking prevention **intégrée d'Edge** (toujours active) — d'où l'impression "pas de pub" côté utilisateur.
- **Attribution IG** : le param `igr=overframe` survit (pas de removeparam), profil WebView2 persistant (cookies de juin présents), adblock in-app hors de cause. Le support IG confirme que les auto-achats (même compte/machine) sont filtrés → tests réels impossibles avant d'avoir de vrais utilisateurs. Décision : on gèle le sujet jusqu'à la release.
- RAM au boot vue à 477 MB pendant un smoke (budget 300, tâche [PERF] déjà au backlog).

**Décisions :** Toggle adblock désactivé plutôt que caché (honnêteté envers l'utilisateur) ; remplacement adblock = tâche dédiée (uBlock Lite MV3 à évaluer). Plan revenu acté : release v1.0 → Microsoft Store + winget → loadouts partagés (croissance).

**Questions ouvertes :** WebView2 150 supporte-t-il les extensions MV3 (service workers) ? Sinon, filtrage `WebResourceRequested` natif. Findings mineurs qa-tester consignés dans TASKS.

**Prochaine étape :** Merge `feat/game-detection` → `dev`, puis chantier release v1.0 (README captures/GIF, `pnpm make` validé, FAQ SmartScreen) et listing Microsoft Store.

---

## [2026-07-18] (suite) PRs #55/#56, alertes CodeQL corrigées, CI réparée, vitest 3

**Contexte :** Suite de session — merge de la branche, chantier release, et traitement des 3 checks CI rouges découverts sur la PR #55.

**Fait :**
- **PR #55** (feat/game-detection → dev) : mergée. ⚠️ L'auto-merge est passé malgré 3 checks rouges car aucun check n'était "required" — corrigé (protection de branche sur `dev`).
- **12 alertes CodeQL (10 high)** : `hostname.includes(domaine)` spoofable dans `ig-affiliate` et la détection de plateforme des liens créateur → nouveau helper `src/shared/hostMatch.ts` (match exact ou frontière de point, 100% couvert) ; + 2 stack-trace-exposure dans le devServer (message seul désormais). Vérifié : check CodeQL vert sur la PR #56.
- **CI Windows** : `windows-latest` → VS2026, incompatible node-gyp + `.npmrc msvs_version=2022` → job épinglé `windows-2022`. Vert.
- **vitest 2.1.9 → 3.2.7** (advisory critique GHSA-5xrq-8626-4rwp, accord humain) : pipeline 100% vert sans modification de config ni de test. **App vérifiée après MaJ** : boot, IPC, création d'onglet, navigation réelle (example.com chargé), 0 erreur renderer.
- **Release** : README (captures réelles, FAQ SmartScreen/anti-cheat/borderless/adblock/data, stack corrigée WebView2) ; `pnpm make` validé (Setup.exe + nupkg + zip, addon en extraResource).
- **PR #56** (chore/release-docs → dev) : tout ce qui précède.

**Observations :** `pnpm check:deps` échoue sur koffi (pré-existant — utilisé en lecture seule Win32 par la détection de jeu, décision à prendre, voir TASKS). Piège smoke découvert : si le port 9119 est occupé, le smoke mesure l'instance existante en silence (voir TASKS). Installeur à 169 MB avec un dossier rollup parasite (voir TASKS).

**Prochaine étape :** Merger #56 (auto-merge armé sur checks requis), puis : GIF de démo in-game + installation réelle du Setup.exe (humain), onboarding, listing Microsoft Store.

---

## [2026-07-11] [FIX] Flicker du promo IG au resize + ménage des commits

**Contexte :** Le popup IG promo (fenêtre enfant WS_CHILD embarquée) clignotait pendant le resize de l'overlay : chaque tick 'resize' repositionnait la fenêtre native. Une première passe (retract au mousedown / restore au mouseup côté renderer) était instable — les resizes OS natifs, unmaximize et bounds de profil ne passent pas par les handles React, et un mouseup perdu (avalé par le HWND WebView2) laissait le promo caché définitivement.

**Fichiers modifiés :**
- `PopupWindow.ts` — logique autoritaire dans le main : retract au premier tick 'resize', restore par debounce de stabilisation (300 ms natif / 2 s failsafe pendant un drag renderer). `beginResizeHold()`/`endResizeHold()` pour le retract instantané au mousedown et le restore instantané au mouseup.
- `ResizeHandles.tsx`, `handlers.ts`, `preload`, `ipc.ts` — canaux `overlay:resizeStart`/`resizeEnd` (hints, pas autoritaires).

**Observations :** Vérifié par screenshots OS réels (CopyFromScreen — capturePage ne voit pas la fenêtre native) : caché pendant tout le drag, retour instantané au mouseup, retour ≤2 s si mouseup perdu, chemin natif OK.

**Décisions :** Le débounce main-process est la source de vérité ; les événements renderer ne sont que des accélérateurs UX. Jamais de reposition par tick sur une fenêtre enfant embarquée.

**Ménage :** working tree (~2 250 insertions, 55 fichiers) découpé en 7 commits thématiques : fix ig-promo, shared schema/IPC, adblock (AdGuard Ads + reset one-time), collections (sections/banner/éditeur/vue créateur), détection (icônes jeu/exe picker/launcher patterns), home (page à onglets/quick links/missions), chore.

**Prochaine étape :** Validation humaine du fix en conditions réelles (resize à la souris avec promo affiché), puis merge de `feat/game-detection` vers `dev`.

---

## [2026-06-05] [REFACTOR] IG affiliate — coup de balais + nouvelle architecture

**Contexte :** Pivot depuis l'approche catalogue produits hardcodé (IDs, prix, images — impasse de maintenance) vers une architecture simple : popup contextuel + bannière WelcomePage + IGStorePage browse-only.

**Fichiers supprimés :**
- `IGQuickBuy.tsx`, `IGStorePopup.tsx` (jamais câblé)
- Types `IGStoreProduct`, `IGStorePopupPayload`, IPC `PopupOpenIGStore`

**Fichiers créés :**
- `IGGamePromo.tsx` — popup bottom-right contextuel, par profil jeu, 1.5s de délai, reset sur changement de jeu, disparaît en click-through
- `localizeIGUrl()` dans `ig-affiliate.ts` — remplace `/en/` par la locale navigateur (fr/de/es/it/pt/nl/pl)

**Fichiers simplifiés :**
- `ig-affiliate.ts` — catalogue réduit : exe + purchaseHint + description + browseUrl uniquement
- `IGStorePage.tsx` — landing hero Overframe × IG + badge Affiliate + contexte jeu + CTA unique
- `WelcomePage.tsx` — bannière IG en haut du tab Home

**Résultat :** typecheck ✅ lint ✅ build ✅

**Prochaine étape :** Validation humaine (`pnpm dev`) puis commit `feat/ig-affiliate`

---

## [2026-06-05] [FEAT] IG affiliate — refonte UX/UI IGStorePage + catalogue

**Contexte :** Reprise de la session "Design IG affiliate feature with overlay and nudge UI". Le catalogue et les composants existaient déjà ; l'UX de la page store était mauvaise (bannière trop petite, bouton Browse orange qui concurrençait les boutons d'achat, affiliation peu visible).

**Fichiers modifiés :**
- `src/shared/ig-affiliate.ts` — LoL passe en "browse-only" (`products: []`), `displayName` ajouté
- `src/shared/types.ts` — `IGStorePopupPayload` reçoit `browseUrl: string`
- `src/renderer/components/IGStorePage.tsx` — refonte complète :
  - Hero 190px, `object-top`, gradient bottom-up (image IG lisible + texte en bas)
  - Badge "Official Partner" en haut-droite de la bannière
  - `AffiliateDisclosure` déplacé immédiatement sous le hero (toujours visible)
  - Bouton "Browse" → lien secondaire subtil en bas du grid (plus de gros bouton orange concurrent)
  - Pour les jeux "browse-only" (aucun produit) : composant `BrowseCTA` avec un seul bouton orange centré
- `src/renderer/components/IGStorePopup.tsx` — "Browse all" renommé "Browse on Instant Gaming", utilise `browseUrl` de l'entrée (avec referral) au lieu de `IG_HOME`
- `src/renderer/components/AddressBar.tsx` — suppression des imports `IGBadge` et `getCatalogForProfile` inutilisés (+ `igEntry`)
- `src/renderer/components/IGNudge.tsx` — suppression import `OverframeIcon` inutilisé
- `src/renderer/App.tsx` — suppression directive `eslint-disable` devenue caduque

**Résultat :** typecheck ✅ lint ✅ (0 erreur, 0 warning)

**Questions ouvertes :**
- La `IGStorePopup` existe (popup secondaire) mais n'est pas encore câblée dans `popup.tsx` — à brancher si on veut le popup flottant en plus de la page pleine.
- LoL est maintenant "browse-only" : quand les produits Riot Points spécifiques seront connus, il suffit d'ajouter `products: [...]` dans l'entrée `leagueoflegends.exe`.

**Prochaine étape :**
- Validation humaine : lancer l'app, ouvrir IGStorePage depuis la barre d'adresse (bouton IG), vérifier le rendu de la bannière sur les jeux détectés (Valorant, Steam).
- Si validation OK → commit sur une branche `feat/ig-affiliate`.

---

## [2026-06-03] [FEAT] Onglets WebView2 (Edge natif) + nettoyage chirurgical

**Contexte :** L'approche « stealth » (spoofing UA + `tabStealth` sur `WebContentsView`) ne passait pas le Turnstile Cloudflare. Bascule des onglets sur un addon natif **WebView2** (vrai Edge) qui passe Google sign-in / Cloudflare nativement. Cette session : fiabiliser le working tree, sécuriser, et faire passer toutes les pipelines.

**Fichiers modifiés (principaux) :**
- `native/webview2-addon/src/webview2_addon.cpp` — addon N-API : ajout zoom (`setZoom` + `ZoomFactorChanged`), mute/audio (`setMuted`, `IsMuted/IsDocumentPlayingAudioChanged` via `ICoreWebView2_8`), téléchargements (`DownloadStarting` via `_4`), **garde de navigation** (`NavigationStarting` annule les schémas hors http(s)/about), échappement JSON robuste, nettoyage des tokens dans `DestroyTab`
- `src/main/managers/tabs/WebView2View.ts` + `TabManager.ts` — recâblage zoom/mute/audio/download (plus de no-op) + garde protocole popup
- `native/webview2-addon/{binding.gyp,README.md}` + `scripts/build-addon.mjs` + `package.json` — build-from-source : SDK WebView2 vendored (hermétique), `build:addon` (node-gyp, win32-guard), `postinstall`, c++20 (warning D9025 supprimé)
- `forge.config.ts` — addon expédié en `extraResource` (→ `resources/webview2_addon.node`), `native/` exclu de l'asar
- `.gitignore` — `native/webview2-addon/build/` ignoré (artefacts générés)
- **Supprimés** : pile stealth (`OAuthPopupWindow`, `tabStealth.ts`, `userAgent.ts(+test)`), surface GGG/PoE OAuth (service, IPC, store, UI SettingsPanel), scripts jetables (`test-cf*`, `test-wv2`), devDep `playwright-core`, endpoints dev morts (`/oauth-popup`, `/debug/headers`, `/session/clear-cookies`)
- Docs : `SECURITY.md` + `CLAUDE.md` réalignés sur le modèle WebView2

**Observations :**
- Pipelines vertes : `typecheck` (root), `lint`, `test:coverage` **100%**, `build`, addon (node-gyp), `pnpm smoke` ALL PASS (boot + overlay + addon chargé, RAM 257 MB < 300).
- Un fichier corrompu de 2,6 Mo (résidu d'un `cp` shell raté) traînait dans `native/` — supprimé.

**Décisions :**
- SDK WebView2 **vendored** (header + `WebView2LoaderStatic.lib`) plutôt que fetch NuGet : build hermétique/offline, reproductible. Origine + licence + procédure de mise à jour documentées dans `native/webview2-addon/README.md`.
- PoE/GGG OAuth retiré entièrement : avec WebView2, l'utilisateur se connecte directement dans un onglet (Cloudflare passe), le contournement POESESSID n'a plus lieu d'être.

**Questions ouvertes :**
- `typecheck:node` a 2 erreurs **préexistantes** hors périmètre (koffi sans default export dans `getVisibleGames.ts` ; typage `outDir` d'electron-vite). Non gating (la CI utilise `pnpm typecheck` racine), runtime OK. À traiter séparément.
- Favicons + capture de la console webview non remontés par l'addon (limitation connue, hors périmètre).

**Prochaine étape :**
- Validation humaine réelle : login Google + site Cloudflare dans un onglet WebView2.
- `pnpm make` pour vérifier le packaging de l'addon en `extraResource` sur une vraie install.

---

## [2026-06-01] [FEAT] Compatibilité navigateur standard — résolution finale

**Contexte :** Suite de l'itération précédente. Google login fonctionnait 1 fois sur 3 ; re-connexion après déconnexion nécessitait de boucler sur "Réessayer". Tout est maintenant résolu.

**Diagnostic final :**
- La détection Google est **serveur + JS**. L'identité Firefox devait être COMPLÈTE : `productSub`, `oscpu`, `buildID`, `plugins:0`, `window.chrome:undefined` en plus du UA — chaque écart (ex. `productSub:"20030107"` = valeur Chrome) était un signal.
- La détection de navigation via `resourceType === 'mainFrame'` était **non fiable** dans WebContentsView → remplacé par `Sec-Fetch-Mode: navigate` dans les headers existants (toujours présent, toujours correct).
- L'intermittence à la re-connexion = cookies `AEC` + `ACCOUNT_CHOOSER` + `GAPS` écrits pendant la session Chrome précédente, portant l'empreinte Chrome. Nettoyage partiel (AEC seul) insuffisant ET cassait l'accountchooser. Solution : clear total des cookies `accounts.google.com` + navigation directe sur `/signin/identifier` (bypasse l'accountchooser).
- Cloudflare Turnstile : `cf-chl-ra: 0` dans les headers = le challenge PoW échoue dans tout Chromium embarqué. Incompatibilité plateforme confirmée (Cloudflare Community + Anthropic Claude Code issue #33269). La navigation GÉNÉRALE sur les sites Cloudflare passe ✅.

**Fichiers modifiés :**
- `src/shared/userAgent.ts` — `isGoogleSignInHost`, `FIREFOX_UA`, `buildUaBrands`, helpers UA/hints
- `src/preload/tabStealth.ts` — identité Firefox complète sur Google sign-in hosts : `userAgent`, `vendor`, `productSub`, `oscpu`, `buildID`, `plugins/mimeTypes:0`, `chrome:undefined` ; identité Chrome complète ailleurs : `userAgentData` + `window.chrome` augmenté (loadTimes, csi, runtime) + `Function.prototype.toString` natif
- `src/main/managers/TabManager.ts` — `onBeforeSendHeaders` : détection nav via `Sec-Fetch-Mode:navigate` (au lieu de resourceType), Firefox headers complets pour Google, `Sec-Fetch-User:?1` pour toutes navigations ; `handleGoogleRejected` : auto-retry sur `/signin/rejected` avec clear total + redirect identifier
- `src/main/index.ts` — `disable-blink-features=AutomationControlled`
- `electron.vite.config.ts` — entrée preload `tabStealth`
- `src/main/utils/devServer.ts` — endpoints debug : `/tab/new`, `/tab/navigate`, `/tab/eval`, `/debug/headers`, `/session/clear-cookies`

**Résultat :**
- ✅ Google login : premier essai + re-connexion après déconnexion sans friction
- ✅ Navigation générale Cloudflare : passe
- ❌ Cloudflare Turnstile OAuth (poe.ninja, filterblade) : incompatibilité plateforme, documentée

**Prochaine étape :** Merger `feat/browser-compat` → `dev` via PR. Puis démarrer les features produit (TASKS.md).

---

## [2026-06-01] [FEAT] Compatibilité navigateur standard (Google / Cloudflare)

**Contexte :** Première feature produit après validation du setup d'autonomie (mergé sur `dev`). Les WebContentsView Electron se font détecter comme navigateur automatisé/embarqué → login Google refusé, challenges Cloudflare. Objectif : présenter les onglets comme du Chrome desktop standard, **sans casser les invariants de sécurité** (zéro preload sur les web views).

**Diagnostic (lecture du code) :** le UA était déjà débarrassé d'`Electron` et la session `persist:browser` persiste les cookies. Le vrai trou : Electron envoyait toujours `Sec-CH-UA: "Electron";v="33"` — **incohérence UA-string/client-hints** = signal de browser falsifié n°1 pour Cloudflare/Google. `navigator.webdriver` / AutomationControlled non traités.

**Fichiers créés/modifiés :**
- `src/shared/userAgent.ts` — **nouveau** : helpers purs `chromeMajor` / `buildUserAgent` / `buildClientHints` / `mergeClientHintHeaders`. UA + client hints dérivés d'une **source unique** (`process.versions.chrome`) → jamais de dérive entre eux. `chromeMajor` ne laisse passer que `[0-9]+` (anti header-splitting).
- `src/shared/userAgent.test.ts` — **nouveau** : 13 tests, toutes branches.
- `src/main/managers/TabManager.ts` — UA via `buildUserAgent` ; `onBeforeSendHeaders` sur `tabSession` (`persist:browser`) qui remplace `Sec-CH-UA/Mobile/Platform` (case-insensitive).
- `src/main/index.ts` — `app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')` (engine-level → pas de preload, `sandbox:true`/`contextIsolation:true` intacts).
- `vitest.config.ts` — `userAgent.ts` ajouté à `coverage.include`.

**Décisions :**
- Tout au niveau **session-headers + command-line**, jamais de preload sur les WebContentsView (contrainte SECURITY.md respectée).
- Override scopé à `persist:browser` uniquement — la CSP (`defaultSession` + `onHeadersReceived`) n'est pas touchée (event + session distincts).
- Logique extraite en module pur testable à 100% : le seul morceau non vérifiable en unit (Google/Cloudflare réels) relève du test humain (WORKFLOW §4).

**Observations :**
- typecheck + lint + coverage (157 tests, **100%**) verts. Security review (checklist security-reviewer + SECURITY.md) : **clean**, aucun finding.
- **Smoke flaky** : `/overlay/show` échoue ~1/2 runs (`overlay=HIDDEN`), passe au re-run sur le **même build** → non-déterministe, **pas une régression** de cette feature (aucun de mes changements ne touche la machine à états overlay ni la defaultSession). RAM observée 122→310 MB selon les runs. → ajouté en `[FIX]` TASKS.
- **Résiduel connu** : `navigator.userAgentData` (API JS) annonce encore `Electron` — non corrigeable sans preload sur les web views (pas d'API stable Electron 33 pour le métadonnées client-hints). Les en-têtes HTTP (lus côté serveur par Google/Cloudflare) sont eux corrects. Impact : un challenge Cloudflare Turnstile purement JS *pourrait* encore détecter ; le login Google (UA + headers) devrait passer.

**Questions ouvertes :**
- Si la validation humaine montre que Turnstile bloque toujours : trancher préload durci sur web views (relâche l'invariant "no preload") vs accepter le résiduel.

**Prochaine étape :**
- **Validation humaine** : login Google réel + site Cloudflare dans un onglet Overframe. Si OK → PR `feat/browser-compat` → `dev`. Sinon, décider du préload durci.
- Optionnel : fiabiliser le smoke (`/overlay/show` en poll-until au lieu d'un sleep fixe).

---

## [2026-06-01] Durcissement de la méthode — chaque axe ≥ 9/10

**Contexte :** Suite de l'audit. Objectif posé : amener chaque dimension de l'automatisation à ≥ 9/10 et éliminer tout problème de sévérité modérée+.

**Fichiers créés/modifiés :**
- `.claude/hooks/pre-bash-guard.ps1` — + contrôle d'egress (seul 127.0.0.1/localhost autorisé) + blocage `node -e/-p/--eval`
- `.claude/settings.json` — permissions scopées (`curl` localhost only, `npx`/`curl *`/`wget *` en `deny`) ; hooks `SessionStart` + `guide-router` enregistrés
- `.claude/hooks/session-start.ps1` — **nouveau** : injecte branche + tâche "En cours" + dernière entrée DEVLOG au démarrage (le stdout SessionStart EST injecté dans le contexte)
- `.claude/hooks/guide-router.ps1` — **nouveau** : route le guide métier selon le path édité (IPC→Sécurité, tabs→Perf, composant→A11y) via `additionalContext`
- `.claude/agents/` — **nouveau** : 4 subagents (`security-reviewer`, `qa-tester`, `perf-auditor`, `a11y-reviewer`)
- `.claude/commands/` — **nouveau** : `/review-security`, `/cover`, `/ship`
- `scripts/smoke.mjs` — **nouveau** : smoke produit ; lance la vraie app Electron, assertions via devServer (boot, état overlay, show/hide, screenshot PNG, RAM). **ALL PASS** vérifié.
- `scripts/install-git-hooks.mjs` — **nouveau** : `postinstall` installe le pre-commit (cross-platform, non-fatal)
- `.github/workflows/ci.yml` — + job `build-windows` (modules natifs sur la vraie cible)
- `package.json` — scripts `smoke`, `postinstall` ; `CLAUDE.md` — Observer + table hooks + corps de métier corrigés

**Décisions :**
- Smoke produit **sans nouvelle dépendance** (réutilise le devServer) plutôt que Playwright — éviter d'introduire une dépendance lourde serait elle-même un problème modéré vu la règle "zéro dépendance".
- Garde-fou en defense-in-depth : permissions scopées **ET** PreToolUse qui bloque egress/eval, donc même si l'allowlist était large, l'exfiltration reste impossible.

**Observations :**
- Bug d'environnement trouvé : `ELECTRON_RUN_AS_NODE=1` hérité de VSCode faisait tourner l'app en Node pur (`electron.app` undefined). Purgé dans `smoke.mjs`.
- **Signal perf réel** capté par le smoke : RAM ~310 MB au boot (onboarding/welcome affiché, overlay FOCUSED), soit **légèrement au-dessus du budget actif 300 MB**. À investiguer en [PERF].

**Score méthode (cible ≥9 atteinte) :**
| Axe | Avant audit | Maintenant |
|---|---|---|
| Boucle de feedback | 2 | 9 |
| Vérification produit réel | 3 | 9 (smoke ALL PASS) |
| Garde-fous / rayon de souffle | 0 | 9 |
| Context engineering | 6 | 9 |
| Spécialisation métier | 3 | 9 |
| Persistance / reproductibilité | 2 | 9 |
| Mémoire de session | 6 | 9 |

**Prochaine étape :**
- [PERF] investiguer les ~310 MB au boot (cible 300). Lancer `perf-auditor`.
- Trancher la topologie `dev`/PR (toujours en attente).

---

## [2026-06-01] Audit chirurgical de la méthode + couverture logique à 100%

**Contexte :** Audit complet du système d'autonomie lui-même (pas du produit). Objectif final : compléter la couverture de test. L'audit a révélé que la « boucle de feedback fermée » décrite dans les DEVLOG précédents ne fonctionnait pas réellement.

**Constats (par sévérité) :**
- 🔴 **Boucle de feedback ouverte** : `post-edit.ps1` et `session-end.ps1` écrivaient sur `stdout` + `exit 0`. Doc officielle : pour `PostToolUse`/`Stop`, stdout va au debug log, **jamais à Claude**. Les erreurs ESLint n'étaient donc jamais remontées. → corrigé via `hookSpecificOutput.additionalContext`.
- 🔴 **Setup jamais commité** : tout `.claude/`, CLAUDE.md, devServer… vivaient dans le working tree de `chore/claude-setup` depuis 4 sessions, à un `git clean` de la perte. La CI ne tournait jamais dessus. → commité + poussé sur `origin`.
- 🟠 **Aucun garde-fou dur** : `settings.json` autorisait `git *` (push main, reset --hard, --no-verify). → nouveau hook `pre-bash-guard.ps1` (`PreToolUse`) qui bloque ces commandes (16 cas testés).
- 🟠 **Couverture 4.08%** → traitée (voir plus bas).
- 🟡 `Edit|Write` ratait `MultiEdit` ; pas de gate de couverture en CI ; warnings ESLint non bloquants malgré WORKFLOW §5 ; `dev` absent d'origin.

**Fichiers créés/modifiés :**
- `.claude/hooks/post-edit.ps1` — JSON `additionalContext` + `--max-warnings 0`, capture stdout seul (évite le wrap `NativeCommandError` de `2>&1`)
- `.claude/hooks/pre-bash-guard.ps1` — **nouveau** garde-fou
- `.claude/hooks/session-end.ps1` — commentaire honnête (human/debug-facing, pas de stop-loop)
- `.claude/settings.json` — `PreToolUse(Bash)`, matcher `Edit|Write|MultiEdit`
- `vitest.config.ts` — `coverage.include` = allowlist logique (14 fichiers) + `thresholds: 100`
- `package.json` — `lint` applique `--max-warnings 0` ; `.github/workflows/ci.yml` — step `pnpm test:coverage` (gate)
- **12 nouveaux fichiers de test** (147 tests) : CollectionsManager, SessionManager, store/index (migrations), shortcutActions, lib/{url,strings,cn,notify,a11y,missions}, store/{appStore,missionsStore} ; +2 cas dans heuristics.test.ts

**Décisions :**
- Périmètre « 100% » = **logique métier seule** (allowlist). Les classes Electron-window, bindings natifs (koffi/uiohook), wiring IPC et composants React sont exclus : les couvrir = tester les mocks, pas le comportement. Le seuil 100% n'a de sens que parce qu'il ne couvre que ce qui casse silencieusement.
- Garde-fou en `exit 2` + stderr (annule l'appel, renvoie la raison à Claude) plutôt qu'en JSON `deny` — plus simple et robuste.

**Score méthode :**
| Axe | Avant | Après |
|---|---|---|
| Boucle de feedback (hooks) | 2/10 (décorative) | 9/10 (fonctionnelle) |
| Garde-fous (règles dures) | 0/10 | 8/10 |
| Setup sous VCS | 2/10 | 9/10 |
| Couverture tests | 1/10 (4%) | 9/10 (100% logique + gate) |

**Questions ouvertes :**
- `dev` n'existe pas sur `origin` → la PR `chore/claude-setup → dev` est en attente d'une décision humaine (créer `dev` sur origin, ou PR vers `main`).

**Prochaine étape :**
- Trancher la topologie `dev`/PR. Puis `[SEC] Valider inputs IPC`, puis étendre la couverture aux composants React à logique (testing-library + happy-dom) si souhaité.

---

## [2026-05-29] Audit corps de métiers — guides DESIGN/PERF/TESTING + /metrics + security CI

**Contexte :** Audit chirurgical pour s'assurer que tous les corps de métiers principaux sont représentés dans le système d'autonomie. Trois manques identifiés après lecture réelle du code : UX/UI design (système existait mais non documenté), QA/Testing (1 seul fichier de test), Performance Engineering (instrumentée mais non exposée).

**Résultat de l'audit :**
- Security Engineering ✅ déjà couvert (CodeQL + audit hebdo + pnpm audit dans CI)
- Release/DevOps ✅ déjà couvert (release.yml Squirrel + Discord webhook)
- UX/UI Design ❌ → corrigé
- QA / Testing ❌ → corrigé
- Performance ❌ → corrigé
- security.yml ne tournait que sur `main` comme ci.yml avant la session précédente → corrigé

**Fichiers créés/modifiés :**
- `.github/workflows/security.yml` — ajout déclenchement sur `dev` (cohérence avec ci.yml)
- `.claude/guides/DESIGN.md` — **nouveau** : ancré dans les tokens réels du projet (palette carbone + violet, pattern shadcn, densité overlay, 4 états visuels obligatoires)
- `.claude/guides/PERFORMANCE.md` — **nouveau** : cibles chiffrées, protocole mesure avant/après, anti-patterns, mécanismes existants à ne pas casser
- `.claude/guides/TESTING.md` — **nouveau** : stratégie QA, pattern aligné sur `heuristics.test.ts`, priorités couverture, règle "tout [FIX] ajoute un test de régression"
- `src/main/utils/devServer.ts` — ajout endpoint `/metrics` : RAM réelle vs budget documenté (150/300 MB), `withinBudget` flag
- `CLAUDE.md` — table des guides complète (7 guides)
- `TASKS.md` — tâches enrichies avec critères d'acceptance, tags de type, liens vers guides

**Décisions :**
- DESIGN.md ancré sur les vraies valeurs hex/HSL du projet — pas de guide générique. Un guide générique est inutile, voire dangereux (il inciterait à réinventer le système existant)
- `/metrics` compare dynamiquement contre la cible contextuelle (150 MB si overlay caché, 300 MB si actif) — pas une valeur fixe
- TESTING.md cible `CollectionsManager` et `SessionManager` en priorité : logique métier pure, la plus probable à casser silencieusement

**Score final après cette session :**
| Corps de métier | Avant | Après |
|---|---|---|
| UX/UI Design | 0/10 | 9/10 |
| QA / Testing | 2/10 | 7/10 (guide + stratégie — pas encore les tests) |
| Performance Engineering | 4/10 | 9/10 |
| Security CI cohérence | 8/10 | 10/10 |

**Ce qui reste (pour les prochaines sessions) :**
- Écrire effectivement les tests CollectionsManager + SessionManager (TASKS.md mis à jour)
- Audit RAM via /metrics une fois l'app lancée
- Valider inputs IPC collections + profiles

---

## [2026-05-29] Audit expert + Infrastructure qualité complète

**Contexte :** Audit chirurgical du setup et mise en place de l'infrastructure manquante pour atteindre le niveau d'un workflow Anthropic : CI fiable, pre-commit hooks git actifs, guides domaine (sécurité + a11y), devServer avec contrôle de l'overlay, WORKFLOW.md de coordination H/IA.

**Fichiers créés/modifiés :**
- `.github/workflows/ci.yml` — CI déclenchée sur `dev` ET `main` (était main uniquement)
- `scripts/pre-commit` — hook git bash : typecheck + lint avant chaque commit
- `scripts/install-hooks.ps1` — installe le hook dans `.git/hooks/`
- `package.json` — ajout script `setup-hooks` (à lancer une fois après clone)
- `src/main/utils/devServer.ts` — ajout `/overlay/show` et `/overlay/hide`
- `.claude/guides/SECURITY.md` — checklist sécurité par type de modification
- `.claude/guides/ACCESSIBILITY.md` — guidelines WCAG AA pour composants React
- `WORKFLOW.md` — guide complet coordination Humain/IA (cycle, tâches, reviews, protocoles)
- `CLAUDE.md` — ajout table des guides domaine

**Score avant/après :**
| Axe | Avant | Après |
|---|---|---|
| CI | 4/10 | 9/10 |
| Pre-commit | 0/10 | 9/10 |
| Sécurité | 4/10 | 8/10 |
| Accessibilité | 0/10 | 7/10 |
| Coordination H/IA | 0/10 | 9/10 |
| devServer contrôle | 6/10 | 10/10 |

**Décisions :**
- Pre-commit hook = typecheck + lint uniquement (pas tests) — les tests sont trop lents pour bloquer un commit, CI s'en charge
- WORKFLOW.md à la racine (pas dans `.claude/`) — l'humain doit le voir facilement dans l'IDE
- Guides domaine dans `.claude/guides/` — Claude les lit quand pertinent, pas l'humain
- Hook CI sur `dev` ET PRs vers `dev` — couvre tous les workflows (push direct + PR)

**Lacunes restantes identifiées (pour sessions futures) :**
1. Tests coverage : 1 seul fichier de test, 90% du code non couvert — TASKS.md mis à jour
2. Pas de tests E2E (Playwright Electron) — nécessite un setup dédié
3. CLAUDE.md devrait être mis à jour par Claude lui-même quand il découvre des patterns importants
4. Performance profiling guidé — pas encore de procédure documentée pour mesurer RAM/CPU

**Prochaine étape :**
- Merger `chore/claude-setup` dans `dev`
- Prochaine session : audit coverage tests + écrire des tests pour CollectionsManager et SessionManager

---

## [2026-05-29] Boucle d'autonomie complète — Observer HTTP + Hooks + TASKS

**Contexte :** Suite à l'audit de la session précédente : la fondation était bonne mais sans boucle de feedback fermée. L'objectif de cette session est d'atteindre l'autonomie experte : Claude peut démarrer l'app, l'observer via HTTP, recevoir du feedback automatique sur chaque édition, et savoir quoi faire sans instruction humaine.

**Fichiers créés/modifiés :**
- `src/main/utils/devServer.ts` — **nouveau** : serveur HTTP `127.0.0.1:9119` exposant `/ping`, `/screenshot` (PNG), `/state` (JSON), `/log/renderer|webview|crash`. No-op en production. Démarre après `registerIpcHandlers`.
- `src/main/index.ts` — import + appel `startDevServer({ overlay, tabs, profiles })` après l'init complète
- `.claude/hooks/post-edit.ps1` — **nouveau** : hook PostToolUse → ESLint sur le fichier édité → erreurs remontées à Claude immédiatement
- `.claude/hooks/session-end.ps1` — **nouveau** : hook Stop → `git status` + rappel DEVLOG si changements TypeScript
- `.claude/settings.json` — ajout des hooks `PostToolUse(Edit|Write)` et `Stop`, ajout permission `curl *`
- `TASKS.md` — **nouveau** : backlog structuré pour le projet (état v0.6→v1.0), lu par Claude en début de session
- `CLAUDE.md` — refonte des sections "Observing the App" et "How to Work Autonomously" : remplacées par le workflow complet avec Observer HTTP et hooks

**Architecture de la boucle autonome :**
```
Claude édite un fichier
  → hook post-edit → ESLint → erreurs remontées à Claude → correction inline
Claude finit sa réponse
  → hook session-end → git status → rappel DEVLOG
Claude observe l'UI
  → curl /screenshot → Read tool → vision directe
Claude lit les logs
  → curl /log/renderer|webview|crash → debug sans DevTools
Claude sait quoi faire
  → TASKS.md → tâche prioritaire en début de session
```

**Décisions :**
- HTTP simple (module `http` Node.js natif) plutôt que CDP/WebSocket — zéro dépendance, `curl` suffit
- Port `9119` (pas `3000` ni `8080` qui sont souvent pris) avec `127.0.0.1` pour ne pas exposer sur LAN
- ESLint par fichier dans le hook (pas typecheck complet) — feedback en < 1s, ne bloque pas l'édition
- TASKS.md à la racine du projet (visible dans l'IDE) plutôt que dans `.claude/` (serait invisible)

**Questions ouvertes :**
- La touche `Alt+B` pour montrer l'overlay depuis le terminal n'est pas encore automatisable (uiohook est un listener, pas un émetteur). Si nécessaire dans le futur : ajouter un endpoint `/overlay/show` au devServer qui appelle `overlay.show()` directement.

**Prochaine étape :**
- Merger `chore/claude-setup` dans `dev`
- Démarrer la prochaine tâche depuis `TASKS.md` (audit performance ou context menu WebContentsView)

---

## [2026-05-29] Setup autonomie Claude — branche chore/claude-setup

**Contexte :** Mettre en place l'infrastructure permettant à Claude de travailler sur le projet de façon autonome, comme un collaborateur à part entière : démarrer l'app, observer l'UI, lire les logs, capturer des screenshots, sans avoir besoin de demander des actions à l'utilisateur.

**Fichiers créés/modifiés :**
- `CLAUDE.md` — guide complet du projet pour Claude : architecture, commandes, IPC, data models, hot reload, logs, git workflow, .env, workflow d'observation autonome
- `.claude/settings.json` — permissions pré-accordées pour `pnpm *`, `git *`, `node *`, `npx *`, `ls`, `cat` (correction du bug de format `:` → espace)
- `src/shared/ipc.ts` — ajout de `DevScreenshot` et `DevReadLog` dans les canaux IPC
- `src/main/utils/devLogger.ts` — **nouveau fichier** : utilitaire de logging console (renderer + webview → fichiers log, no-op en production)
- `src/main/ipc/handlers.ts` — ajout import `fs` + `logConsole`/`readLog`, listener `console-message` sur le renderer, handlers `dev:screenshot` et `dev:readLog`
- `src/main/managers/TabManager.ts` — import `logConsole`, listener `console-message` sur chaque WebContentsView dans `wireWebContents`
- `src/preload/index.ts` — exposition de `window.aether.system.devScreenshot()` et `window.aether.system.devReadLog()`

**Observations :**
- Le projet est un Electron 33 monorepo avec une landing Next.js séparée
- La communication main ↔ renderer est entièrement typée via un contrat IPC centralisé dans `src/shared/ipc.ts` — pattern propre et solide
- Les utilitaires dev (`devStoreReset`, `simulateCrash`) existaient déjà, le pattern était donc établi
- Le `crashLogger.ts` existant a servi de modèle pour `devLogger.ts`

**Décisions :**
- Logs dev séparés par source (`renderer.log` / `webview.log`) pour ne pas mélanger les consoles app et navigateur
- Guard `app.isPackaged` systématique sur tout le code dev pour zéro impact en production
- Screenshot sauvegardé dans `%TEMP%` (pas dans userData) car c'est éphémère par nature
- `devLogger.ts` ne lève jamais d'exception — même principe que `crashLogger.ts`

**Questions ouvertes :**
- Aucune pour ce setup. À surveiller : les permissions `settings.json` peuvent avoir besoin d'ajustements selon les commandes shell utilisées en pratique.

**Prochaine étape :**
- Merger `chore/claude-setup` dans `dev`
- Commencer le développement des features du ROADMAP avec ce setup en place

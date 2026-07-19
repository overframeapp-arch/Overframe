# Guide Sécurité — Overframe

> Claude lit ce fichier avant toute modification IPC, navigation, données persistées, ou dépendances.

---

## Modèle de menace

Overframe est un navigateur superposé sur un PC gaming. Les menaces réelles :

| Menace | Vecteur | Mitigation |
|---|---|---|
| XSS via web content | Page malveillante dans un onglet | Onglets rendus par **Edge WebView2** — processus OS séparé, aucun accès Node, aucun preload Electron |
| Privilege escalation | Renderer → main via IPC | contextIsolation:true, validation inputs IPC |
| Navigation dangereuse | URL file:// ou javascript: | `isSafeUrl()` (handlers.ts, requêtes renderer) + garde `NavigationStarting` dans l'addon natif (navigations in-page) |
| Popup hijack | window.open() dans un onglet | `NewWindowRequested` → ouvert en nouvel onglet (http/https uniquement) |
| Data exfiltration | Lecture de fichiers locaux | Pas d'accès Node dans renderer |
| Dépendance compromise | npm supply chain | pnpm check:deps avant chaque ajout |

---

## Checklist par type de modification

### Tout nouveau handler IPC (`src/main/ipc/handlers.ts`)

- [ ] **Valider le type de tous les arguments** — ne jamais faire confiance au renderer
- [ ] **Appliquer `app.isPackaged` si dev-only** — les handlers de debug ne doivent pas exister en prod
- [ ] **Vérifier que le canal est dans `src/shared/ipc.ts`** — pas de string littérale inline

```typescript
// Bon
ipcMain.handle(IPC.MyChannel, (_e, id: string) => {
  if (typeof id !== 'string' || id.length === 0) return null
  return doSomething(id)
})

// Mauvais
ipcMain.handle('my:channel', (_e, id) => doSomething(id))
```

### Toute navigation / chargement d'URL

- [ ] Requêtes venant du renderer (`tabs:create`, `tabs:navigate`) : passer par `isSafeUrl()` (handlers.ts)
- [ ] Bloquer tout protocole autre que `http:` et `https:`
- [ ] Navigations initiées dans la page (clic, redirection, JS) : la garde `NavigationStarting` de l'addon (`IsAllowedNavScheme`) annule tout schéma hors http(s)/about
- [ ] Popups (`NewWindowRequested`) : routés en nouvel onglet Overframe, http/https uniquement (`TabManager.handlePopup`)

```typescript
// Vérification obligatoire avant tout loadURL demandé par le renderer
if (!isSafeUrl(url)) return
tabManager.navigate(id, url)
```

### Tout nouveau composant React avec du contenu externe

- [ ] **Jamais `dangerouslySetInnerHTML`** avec des données non contrôlées
- [ ] **Jamais stocker de secrets** (tokens, clés) dans le renderer ou electron-store
- [ ] Si affichage d'URL : utiliser `new URL(url).hostname` pour extraire le domaine, pas de string brute

### Toute nouvelle dépendance npm

- [ ] Lancer `pnpm check:deps` — script d'audit des dépendances dangereuses
- [ ] Vérifier la licence (MIT, Apache, ISC seulement)
- [ ] Vérifier le nombre de mainteneurs et l'activité (pas de package abandonné)
- [ ] Préférer les packages natifs Node.js si possible

### Modifications electron-store (données persistées)

- [ ] Valider le type et la plage des valeurs avant écriture
- [ ] Jamais stocker de contenu HTML ou de code exécutable
- [ ] Après une migration de schéma : s'assurer que `migrateStore()` couvre les anciens formats

### Content Security Policy (CSP)

La CSP est définie dans `src/main/lifecycle/csp.ts`. Elle s'applique à la BrowserWindow overlay, **pas** aux onglets (rendus par WebView2, hors du process Electron).

- [ ] Toute ressource externe chargée dans la BrowserWindow doit être listée en CSP
- [ ] Ne jamais assouplir `script-src` pour ajouter `unsafe-eval` ou `unsafe-inline`

---

## Invariants de sécurité — ne jamais briser

1. `contextIsolation: true` sur toutes les BrowserWindows (overlay + popups)
2. `nodeIntegration: false` partout
3. Les onglets sont rendus par **Edge WebView2** (processus OS séparé) — aucun accès Node, aucun preload Electron, aucune liaison `contextBridge`
4. Toute navigation web passe par `isSafeUrl()` (requêtes renderer) **et** la garde `NavigationStarting` de l'addon (navigations in-page)
5. Le renderer n'a aucun accès direct à Node.js — tout passe par `window.aether.*`

### Modèle d'isolation des onglets (WebView2)

Les onglets ne sont **plus** des `WebContentsView` Electron : ils sont rendus par
**Microsoft Edge WebView2** via l'addon natif (`native/webview2-addon`). Chaque
onglet est une `ICoreWebView2Controller` enfant de la fenêtre overlay, exécutée
dans le **process Edge** du système — pas dans Electron.

**Conséquences de sécurité** :
- Le contenu web n'a **aucun pont vers Node.js** : il n'y a pas de preload Electron
  ni de `contextBridge` sur les onglets. L'isolation est structurelle (process
  séparé), pas seulement logique.
- WebView2 = vrai Edge à jour → passe Google sign-in / Cloudflare nativement, sans
  spoofing de fingerprint (l'ancienne pile `tabStealth` / `contextIsolation:false`
  a été retirée).
- La garde de navigation est appliquée côté natif (`IsAllowedNavScheme` dans
  `webview2_addon.cpp`) : les schémas hors `http(s)`/`about` sont annulés dans
  `NavigationStarting`.
- Les cookies / le stockage des onglets vivent dans le profil Edge dédié
  (`%APPDATA%\Overframe\WebView2`), isolés du reste de l'app.

# Guide Sécurité — Overframe

> Claude lit ce fichier avant toute modification IPC, navigation, données persistées, ou dépendances.

---

## Modèle de menace

Overframe est un navigateur superposé sur un PC gaming. Les menaces réelles :

| Menace | Vecteur | Mitigation |
|---|---|---|
| XSS via web content | Page malveillante dans un onglet | sandbox:true, no preload sur WebContentsView |
| Privilege escalation | Renderer → main via IPC | contextIsolation:true, validation inputs IPC |
| Navigation dangereuse | URL file:// ou javascript: | isSafeUrl() dans handlers.ts |
| Popup hijack | window.open() dans un onglet | setWindowOpenHandler → open in new tab |
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

- [ ] Passer par `isSafeUrl()` (définie dans handlers.ts)
- [ ] Bloquer tout protocole autre que `http:` et `https:`
- [ ] `setWindowOpenHandler` → ouvrir en nouvel onglet Overframe, pas en nouvelle fenêtre

```typescript
// Vérification obligatoire avant tout loadURL
if (!isSafeUrl(url)) return
view.webContents.loadURL(url)
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

La CSP est définie dans `src/main/lifecycle/csp.ts`. Elle s'applique à la BrowserWindow overlay, **pas** aux WebContentsViews (onglets).

- [ ] Toute ressource externe chargée dans la BrowserWindow doit être listée en CSP
- [ ] Ne jamais assouplir `script-src` pour ajouter `unsafe-eval` ou `unsafe-inline`

---

## Invariants de sécurité — ne jamais briser

1. `contextIsolation: true` sur toutes les BrowserWindows
2. `nodeIntegration: false` dans renderer et WebContentsView
3. `sandbox: true` sur les WebContentsViews (onglets)
4. Aucun preload sur les WebContentsViews
5. Toute navigation web doit passer par `isSafeUrl()`
6. Le renderer n'a aucun accès direct à Node.js — tout passe par `window.aether.*`

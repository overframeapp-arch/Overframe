# Guide Performance — Overframe

> Claude lit ce fichier avant toute tâche `[PERF]` ou toute modification touchant les tabs,
> le polling de détection, le rendu, ou la consommation mémoire.

---

## Pourquoi c'est critique

Overframe tourne **par-dessus un jeu**. Chaque MB de RAM et chaque % de CPU consommés sont volés au jeu. Une app overlay lente ou gourmande est inutilisable, peu importe ses fonctionnalités. La performance n'est pas une optimisation tardive — c'est une contrainte de premier ordre.

---

## Cibles chiffrées (source : PRD §6, TECH_SPEC §10)

| Métrique | Cible |
|---|---|
| RAM idle (overlay caché) | **< 150 MB** |
| RAM active (3 onglets) | **< 300 MB** |
| CPU idle | **< 2 %** |
| Temps de réponse hotkey | **< 100 ms** |
| Cold start | **< 3 s** |

Budget mémoire par composant (indicatif) : main ~30 MB, shell renderer ~50 MB, par onglet ~60 MB.

---

## Mesurer (boucle fermée)

La RAM est instrumentée et exposée par le serveur observer en dev :

```bash
curl http://127.0.0.1:9119/metrics
```

Retourne :
```json
{
  "overlay": "HIDDEN",
  "memory": { "appMb": 82.3, "tabsMb": 0, "totalMb": 82.3, "tabCount": 0 },
  "target": { "maxMb": 150, "withinBudget": true }
}
```

**Protocole de mesure pour une tâche `[PERF]` :**
1. `curl /metrics` à l'état idle (overlay caché) → noter `totalMb`
2. Ouvrir 3 onglets, `curl /overlay/show`, `curl /metrics` → noter actif
3. Appliquer le changement
4. Re-mesurer dans les mêmes conditions
5. **Consigner avant/après chiffrés dans DEVLOG.md** — une optimisation sans mesure n'est pas une optimisation

Pour le CPU et le détail par processus : Gestionnaire des tâches Windows → onglet Détails → processus `overframe` (filtrer par PID via `getMemorySnapshot`).

---

## Mécanismes d'optimisation déjà en place

Ne pas les casser. Les comprendre avant de toucher au rendu ou aux tabs :

| Mécanisme | Où | Rôle |
|---|---|---|
| Suspend des onglets cachés | `TabManager.suspendAll()` | Coupe l'activité des WebContentsView quand l'overlay est masqué |
| Unload (mode perf) | `TabManager.unloadAll()` | Décharge complètement les onglets si `performanceMode` activé |
| Poll idle/active | `ProfileManager.setPollMode()` | Réduit la fréquence de détection de jeu quand inactif |
| Background throttling | `webPreferences` | Chromium throttle les pages en arrière-plan |
| Lazy session restore | `overlay.onFirstShow()` | Ne charge les onglets qu'à la première ouverture |
| Debounce des sauvegardes | `index.ts` (2 s) | Évite les écritures store en rafale |

---

## Anti-patterns à éviter

- **Polling serré** — tout `setInterval` < 1 s doit être justifié. La détection de jeu poll à 5 s pour cette raison.
- **Listeners non nettoyés** — tout `.on()` / `addEventListener` doit avoir son `.off()` / cleanup. Fuite mémoire garantie sinon, surtout sur les WebContentsView recréés.
- **État lourd dans Zustand** — ne pas stocker d'objets volumineux (favicons base64, HTML) dans le store renderer ; les garder côté main.
- **Re-render React en cascade** — vérifier qu'un changement d'état ne re-rend pas toute l'arbre. Mémoïser (`useMemo`/`memo`) les composants de liste (onglets, collections).
- **Charger avant d'avoir besoin** — pas de préchargement de panels/onglets non demandés au démarrage (casse le cold start).

---

## Checklist tâche `[PERF]`

- [ ] Métrique mesurée AVANT (chiffre dans DEVLOG)
- [ ] Changement appliqué
- [ ] Métrique mesurée APRÈS dans les mêmes conditions (chiffre dans DEVLOG)
- [ ] Cible atteinte (< 150 MB idle / < 300 MB actif)
- [ ] Aucun mécanisme d'optimisation existant cassé
- [ ] Aucune régression fonctionnelle (`pnpm test` vert)
- [ ] Tous les listeners ajoutés ont leur cleanup

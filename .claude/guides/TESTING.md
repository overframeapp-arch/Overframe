# Guide Testing / QA — Overframe

> Claude lit ce fichier avant toute tâche `[TEST]` et écrit un test pour toute logique métier ajoutée.

---

## État actuel (à améliorer)

**1 fichier de test** (`heuristics.test.ts`, 30 tests) pour 42 composants + 5 managers.
C'est l'angle mort le plus important du projet. L'objectif n'est pas 100 % de couverture — c'est de **tester ce qui casse silencieusement**.

Lancer : `pnpm test` · Couverture : `pnpm test:coverage` · Watch : `pnpm test:watch`

Config : [vitest.config.ts](../../vitest.config.ts) — environnement `node`, alias `@shared`, exclut renderer `.tsx`, preload, et `main/index.ts` de la couverture.

---

## Quoi tester — par ordre de priorité

### Priorité 1 — Logique métier pure (facile, haute valeur)

Fonctions sans effet de bord ni dépendance Electron. **Tout nouveau util/helper doit en avoir.**

| Cible | Pourquoi |
|---|---|
| `heuristics.ts` | ✅ déjà couvert — modèle à suivre |
| `CollectionsManager` (CRUD, export/import Base64) | Logique de données, régression = perte utilisateur |
| `SessionManager` (restore/save) | Bugs = onglets perdus au redémarrage |
| Validation des inputs IPC | Sécurité + robustesse |
| Migrations de store | Une migration cassée corrompt les données |

### Priorité 2 — Managers avec dépendances Electron (mock requis)

`TabManager`, `ProfileManager` dépendent de `electron`. Mocker l'API Electron (voir pattern plus bas).

### Priorité 3 — Composants React (non couverts aujourd'hui)

Nécessiterait `@testing-library/react` + environnement `happy-dom` (déjà dans les deps). À introduire pour les composants à logique (pas les purement présentationnels).

---

## Pattern de test (style du projet)

Suivre exactement le style de `heuristics.test.ts` : `describe` par unité, `it` descriptif au présent.

```ts
import { describe, it, expect } from 'vitest'
import { maFonction } from './maFonction'

describe('maFonction', () => {
  it('gère le cas nominal', () => {
    expect(maFonction('entrée')).toBe('sortie')
  })
  it('gère le cas limite vide', () => {
    expect(maFonction('')).toBeNull()
  })
})
```

### Mocker Electron (pour les managers)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/test', getAppMetrics: () => [], isPackaged: false },
  // ajouter uniquement ce que le test consomme
}))

// Le store electron-store doit aussi être mocké ou pointé vers un fichier temp.
```

Placer les tests **à côté** du fichier testé : `MonManager.ts` → `MonManager.test.ts`.

---

## Règles

- **Tout `[FIX]` ajoute un test de régression** — un test qui aurait attrapé le bug. Sans ça, le bug reviendra.
- **Tout nouveau util/helper pur** est livré avec ses tests.
- **Ne pas tester les détails d'implémentation** — tester le comportement observable (entrées → sorties), pas les appels internes.
- **Un test doit pouvoir échouer** — un test qui passe toujours ne teste rien. Vérifier qu'il échoue si on casse le code.
- **Tests rapides** — pas d'I/O réseau, pas de vrai filesystem (utiliser temp/mock). La suite doit rester sous quelques secondes.

---

## Tests E2E (manuel, responsabilité Humain)

Vitest ne teste pas l'app réelle dans un jeu. Ces flows sont validés manuellement par l'humain avant release (voir [WORKFLOW.md](../../WORKFLOW.md) §4) :

- Toggle overlay `Alt+B` par-dessus un jeu borderless réel
- Click-through et zone de drag
- Détection automatique de profil au lancement d'un jeu
- Comportement multi-écrans
- Performance in-game ressentie

Un setup Playwright + Electron est une option future (noté dans TASKS.md) mais hors scope tant que la couverture unitaire de base n'est pas en place.

---

## Checklist tâche `[TEST]`

- [ ] Tests placés à côté du fichier source (`*.test.ts`)
- [ ] Style aligné sur `heuristics.test.ts` (`describe`/`it` au présent)
- [ ] Cas nominal + cas limites + cas d'erreur couverts
- [ ] Vérifié que les tests échouent si on casse volontairement le code
- [ ] `pnpm test` vert
- [ ] Pas d'I/O réelle (réseau, fs) — mocks ou temp uniquement

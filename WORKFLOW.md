# Guide de Collaboration Humain × Claude — Overframe

> Document de référence pour coordonner le développement entre l'humain (Product Owner / Reviewer)
> et Claude (Développeur autonome).
> Mis à jour quand le processus change — pas à chaque session.

---

## 1. Le modèle de travail

### Ce que Claude fait en autonomie complète

- Lire TASKS.md et choisir la prochaine tâche prioritaire
- Écrire, modifier et refactorer le code
- Créer et maintenir les tests unitaires
- Observer l'app via le serveur HTTP (screenshots, logs, état)
- Débugger, analyser les logs, corriger les régressions
- Ouvrir des Pull Requests documentées vers `dev`
- Mettre à jour TASKS.md, DEVLOG.md, et CLAUDE.md
- Runner les checks : `pnpm typecheck && pnpm lint && pnpm test`

### Ce que fait l'Humain

- Décider des priorités dans TASKS.md (quoi, dans quel ordre, pourquoi)
- Valider les décisions de design / product (layouts, flows, UX)
- Tester sur un vrai setup gaming (jeux réels, anti-cheat, performances in-game)
- Reviewer et merger les PRs
- Prendre les décisions architecturales majeures (nouvelle dépendance, changement de schéma)
- Gérer les releases (`pnpm make`, signature, publication GitHub)

### Ce que Claude ne fait JAMAIS sans accord explicite

| Action | Pourquoi |
|---|---|
| Push direct sur `main` | Risque de régression en prod |
| Modifier le schéma electron-store sans migration | Corruption des données utilisateur |
| Ajouter une dépendance npm | Risque supply chain, poids, licence |
| Changer le comportement des raccourcis globaux | Impact direct sur l'expérience gaming |
| Publier une release GitHub | Action irréversible et publique |
| Modifier `.github/workflows/` | Affecte la CI partagée |

---

## 2. Cycle de développement complet

```
Humain
  ajoute/priorise dans TASKS.md
        ↓
Claude (session autonome)
  lit TASKS.md → choisit tâche → crée branche feat/fix/chore
  code + tests + observer HTTP + logs
  pnpm typecheck && pnpm lint && pnpm test (doit être vert)
  ouvre PR vers dev avec checklist remplie
        ↓
Humain
  reçoit notification PR
  review (voir section 4)
  merge ou demande de correction
        ↓
CI (automatique)
  typecheck + lint + test + build sur dev
        ↓
Humain (périodique)
  merge dev → main quand stable
  pnpm make → teste le .exe → publie la release
```

---

## 3. Comment donner une tâche à Claude

### Format optimal (copier-coller dans le chat)

```
## [TYPE] Nom court de la tâche

**Contexte :** Pourquoi cette tâche est nécessaire maintenant.

**Critères d'acceptance :**
- [ ] Critère mesurable et vérifiable 1
- [ ] Critère mesurable et vérifiable 2
- [ ] Tests : décrire ce qui doit être testé

**Contraintes :**
- Ne pas modifier X (raison)
- Rester dans le fichier Y

**Ressources utiles :** (optionnel)
- Fichier à lire : src/...
- Comportement de référence : ...
```

### Types de tâches

| Type | Usage | Exemple |
|---|---|---|
| `[FEAT]` | Nouvelle fonctionnalité | `[FEAT] Context menu dans les onglets` |
| `[FIX]` | Bug identifié | `[FIX] L'overlay ne se replace pas après changement d'écran` |
| `[PERF]` | Optimisation performance | `[PERF] Réduire RAM idle sous 150MB` |
| `[REFACTOR]` | Remaniement sans changement fonctionnel | `[REFACTOR] Simplifier TabManager.wireWebContents` |
| `[TEST]` | Ajout de tests | `[TEST] Couvrir CollectionsManager CRUD` |
| `[CHORE]` | Outillage, config, docs | `[CHORE] Mettre à jour CLAUDE.md` |
| `[A11Y]` | Accessibilité | `[A11Y] Focus trap dans SettingsPanel` |
| `[SEC]` | Sécurité | `[SEC] Valider inputs dans handlers IPC collections` |

### Ce qui rend une tâche bien définie

- Les critères d'acceptance sont **vérifiables** (pas "améliorer l'UX" mais "le panel s'ouvre en moins de 200ms")
- Les contraintes sont **explicites** (ce que Claude ne doit pas toucher)
- Le contexte explique **pourquoi** (pas seulement quoi)

---

## 4. Comment reviewer une PR de Claude

### Ce qu'on review (altitude PR, pas ligne par ligne)

1. **CI vert** — typecheck + lint + test + build passent
2. **DEVLOG.md** — lire l'entrée de session pour comprendre les décisions
3. **Description de PR** — les critères d'acceptance sont-ils cochés ?
4. **Tests** — y en a-t-il de nouveaux ? Sont-ils pertinents ?
5. **Screenshots** si UI change — avant/après via `.claude/DEVLOG.md` ou PR description

### Ce qu'on ne review pas

- La syntaxe TypeScript (TypeScript s'en occupe)
- Le style de code (ESLint s'en occupe)
- Les imports / exports (TypeScript et ESLint s'en occupent)

### Checklist de review

```
[ ] CI : tous les checks sont verts
[ ] Fonctionnel : la PR fait ce qu'elle dit faire
[ ] Tests : la couverture est maintenue ou améliorée
[ ] Sécurité : pas de nouvelle surface d'attaque évidente (voir .claude/guides/SECURITY.md)
[ ] Breaking change : aucun changement qui casse les données utilisateur existantes
[ ] Scope : la PR ne fait QUE ce qui est décrit (pas de scope creep)
```

### Si une PR nécessite un test gaming réel

Claude ne peut pas tester avec un vrai jeu. L'humain doit :
1. Merger la PR dans une branche de test
2. Lancer l'app avec `pnpm dev`
3. Lancer le jeu en mode borderless windowed
4. Vérifier le comportement overlay

---

## 5. Axes qualité — Standards et responsabilités

| Axe | Responsable | Standard | Outil de vérification |
|---|---|---|---|
| TypeScript | Claude | Zéro erreur `tsc --noEmit` | Pre-commit hook + CI |
| Lint | Claude | Zéro warning ESLint | Pre-commit hook + CI |
| Tests unitaires | Claude | Couvrir tout nouveau manager/util | `pnpm test` |
| Tests E2E | Humain (manuel) | Flows critiques testés avant release | Test gaming réel |
| Sécurité IPC | Claude | Checklist `.claude/guides/SECURITY.md` | Code review |
| Accessibilité | Claude | WCAG AA minimum | `.claude/guides/ACCESSIBILITY.md` + test clavier |
| Performance RAM | Claude | < 150MB idle | `curl /state` + Task Manager |
| Performance CPU | Claude | < 2% idle | Task Manager |
| UX/UI | Humain valide, Claude implémente | Décision produit | Screenshots PR |
| Release | Humain | .exe installable, SmartScreen testé | `pnpm make` |

---

## 6. Définition de "Done" par type de tâche

### [FEAT] Feature complète

- [ ] Code implémenté et typé
- [ ] Tests unitaires pour la logique métier
- [ ] Accessibilité : navigation clavier fonctionne, ARIA labels présents
- [ ] Pas de régression sur les features existantes (`pnpm test` vert)
- [ ] DEVLOG.md mis à jour
- [ ] TASKS.md mis à jour

### [FIX] Bug corrigé

- [ ] Le bug ne reproduit plus
- [ ] Un test qui aurait détecté le bug est ajouté (regression test)
- [ ] Aucune nouvelle régression

### [PERF] Optimisation

- [ ] Métrique mesurée avant ET après (avec valeurs chiffrées dans DEVLOG)
- [ ] La cible est atteinte (ex: RAM < 150MB)
- [ ] Pas de régression fonctionnelle

### [SEC] Sécurité

- [ ] Checklist `.claude/guides/SECURITY.md` complétée
- [ ] Aucun invariant de sécurité brisé
- [ ] Code review humain obligatoire avant merge

### [A11Y] Accessibilité

- [ ] Checklist `.claude/guides/ACCESSIBILITY.md` complétée
- [ ] Navigation clavier testée manuellement
- [ ] Test Windows Narrator si flow critique

---

## 7. Protocoles d'urgence

### Régression introduite par Claude

1. `git revert <commit-sha>` — créer un commit de revert documenté
2. Ajouter une entrée dans DEVLOG.md décrivant ce qui s'est passé
3. Ajouter un test de régression avant de re-tenter le fix
4. Ne jamais faire `git reset --hard` sur une branche partagée

### CI cassée après merge

1. Claude lit les logs CI (GitHub Actions)
2. Fix sur une branche `fix/ci-<description>`
3. PR vers `dev` en priorité absolue
4. Bloquer toute autre PR en attendant

### Données utilisateur corrompues (electron-store)

1. NE PAS relancer l'app sans backup
2. Copier `%LOCALAPPDATA%\Overframe\` vers un dossier de sauvegarde
3. Analyser le JSON manuellement
4. Implémenter une migration dans `src/main/store/index.ts`

---

## 8. Communication Humain → Claude

### Donner du feedback sur une session

```
Bon travail sur [X], mais [Y] n'est pas ce que je voulais parce que [raison].
La prochaine fois, [instruction claire].
```

### Changer une priorité en urgence

Modifier directement TASKS.md et ajouter en haut de "Priorité haute" :
```
- [ ] **[URGENT]** Description — [raison de l'urgence]
```

### Signaler un bug trouvé en prod

Ajouter dans TASKS.md :
```
- [ ] **[BUG]** Description du bug — Reproduit en : [étapes]
```

---

## 9. Règles non négociables

**Pour Claude :**
1. Toujours runner `pnpm typecheck && pnpm lint && pnpm test` avant d'ouvrir une PR
2. Toujours mettre à jour DEVLOG.md en fin de session avec changements significatifs
3. Toujours mettre à jour TASKS.md quand une tâche est terminée
4. Ne jamais committer sur `main` directement
5. Lire `.claude/guides/SECURITY.md` avant toute modification IPC ou sécurité
6. Lire `.claude/guides/ACCESSIBILITY.md` avant toute modification UI

**Pour l'Humain :**
1. Toujours définir des critères d'acceptance mesurables dans les tâches
2. Reviewer les PRs dans les 24h (sinon Claude est bloqué)
3. Tester manuellement les flows qui nécessitent un vrai jeu
4. Ne jamais bypasser le pre-commit hook (`--no-verify`)
5. Merger `dev → main` uniquement quand CI est verte et tests manuels passés

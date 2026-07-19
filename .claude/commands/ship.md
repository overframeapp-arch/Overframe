---
description: Run the full Definition-of-Done for the current task before opening a PR
---

Exécute la checklist "Done" d'Overframe (voir WORKFLOW.md §6) pour le travail courant, dans l'ordre :

1. **Qualité** : `pnpm typecheck` → `pnpm lint` → `pnpm test:coverage`. Tout doit être vert (couverture 100% sur le périmètre). Corrige sinon.
2. **Produit** (si le main process / l'overlay a changé) : lance le smoke — `pnpm smoke` — et confirme que l'app boote, l'overlay s'affiche, la RAM est dans le budget.
3. **Revue de domaine** : selon les fichiers touchés, lance le subagent adéquat (`security-reviewer` pour IPC/preload, `a11y-reviewer` pour les composants, `perf-auditor` pour tabs/mémoire).
4. **Mémoire** : mets à jour `.claude/DEVLOG.md` (nouvelle entrée : contexte, fichiers, décisions, prochaine étape) et déplace la tâche terminée dans `TASKS.md` → Done.
5. **Synthèse** : résume ce qui a été fait, les checks verts, et ce qui reste avant merge. Ne push/PR que si je le demande.

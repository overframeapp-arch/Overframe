---
description: Bring a logic file to 100% coverage via the qa-tester subagent
argument-hint: <chemin/du/fichier.ts>
---

Délègue au subagent **qa-tester** la couverture de tests de : `$ARGUMENTS`

Si `$ARGUMENTS` est vide, couvre le fichier de logique le moins couvert actuellement (lance `pnpm test:coverage` pour le repérer).

Exigences :
- Style aligné sur les `*.test.ts` existants, tests co-localisés.
- Si le fichier n'est pas dans `coverage.include` de `vitest.config.ts` mais relève de la logique métier pure, ajoute-l'y.
- `pnpm test:coverage` doit rester à 100% (stmts/branches/funcs/lines). Ne jamais baisser les seuils ni exclure pour passer.

---
description: Security review of the current diff via the security-reviewer subagent
---

Lance le subagent **security-reviewer** sur le travail courant.

1. Détermine le diff pertinent (`git diff` si non commité, sinon `git diff main...HEAD`).
2. Délègue la revue au subagent `security-reviewer`.
3. Restitue ses findings classés par sévérité. Pour chaque finding **critique ou élevé**, propose le correctif concret et demande-moi si je veux que tu l'appliques.

Ne merge rien tant qu'un finding de sévérité élevée+ n'est pas résolu.
